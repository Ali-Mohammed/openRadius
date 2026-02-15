#!/usr/bin/perl
# ============================================================================
# Enterprise Redis Session Tracker for FreeRADIUS
# EdgeRuntime - Real-time online user tracking with stale session detection
#
# Architecture:
#   FreeRADIUS accounting event → rlm_perl → this script → Redis DB 1
#
# Redis Data Model (DB 1):
#   session:{nasip}:{sessionid}     Hash   — per-session detail (TTL = 2× interim)
#   user:sessions:{username}        Set    — set of session keys for this user
#   nas:sessions:{nasip}            Set    — set of session keys for this NAS
#   online:users                    Set    — set of all online usernames
#
# Stale Detection:
#   Each session hash has TTL = 2× Acct-Interim-Interval (default 600s).
#   If no interim arrives, Redis auto-expires the session.
#   A Lua script atomically cleans up sets when sessions expire via keyspace
#   notification (optional), or the query helpers handle stale entries.
#
# Events Handled:
#   Start          — Create session hash + add to all sets + set TTL
#   Interim-Update — Update session hash (traffic/time) + refresh TTL
#   Stop           — Delete session hash + remove from all sets
#   Accounting-On  — NAS booted: bulk-remove all sessions for that NAS
#   Accounting-Off — NAS shutting down: bulk-remove all sessions for that NAS
# ============================================================================

use strict;
use warnings;
use IO::Socket::INET;

# FreeRADIUS provides these global hashes
our %RAD_REQUEST;
our %RAD_REPLY;
our %RAD_CHECK;
our %RAD_CONFIG;

# Forward declarations for FreeRADIUS radiusd:: namespace
# (provided at runtime by rlm_perl, declared here to satisfy strict)
BEGIN {
    # Create radiusd namespace stubs if not already loaded (for syntax checking)
    unless (defined &radiusd::radlog) {
        eval 'sub radiusd::radlog { }';
    }
}

# --- Configuration ---
my $REDIS_HOST    = $ENV{REDIS_HOST}    || 'redis';
my $REDIS_PORT    = $ENV{REDIS_PORT}    || 6379;
my $REDIS_DB      = $ENV{REDIS_DB}      || 1;       # DB 1 = session tracking
my $DEFAULT_TTL   = $ENV{SESSION_TTL}   || 660;      # 11 min (2× 300s interim + 60s grace)
my $MAX_TTL       = $ENV{SESSION_MAX_TTL} || 86400;  # 24h absolute max

# FreeRADIUS return codes
use constant {
    RLM_MODULE_REJECT  => 0,
    RLM_MODULE_FAIL    => 1,
    RLM_MODULE_OK      => 2,
    RLM_MODULE_HANDLED => 3,
    RLM_MODULE_INVALID => 4,
    RLM_MODULE_NOOP    => 7,
    RLM_MODULE_UPDATED => 8,
};

# Global Redis connection (persistent across requests)
my $redis_sock;
my $redis_connected = 0;

# ============================================================================
# Minimal Redis RESP Client (no external modules required)
# Implements just enough of the Redis protocol for our needs
# ============================================================================

sub redis_connect {
    return 1 if $redis_connected && $redis_sock && $redis_sock->connected();

    eval {
        $redis_sock = IO::Socket::INET->new(
            PeerAddr => $REDIS_HOST,
            PeerPort => $REDIS_PORT,
            Proto    => 'tcp',
            Timeout  => 3,
        ) or die "Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT: $!";

        $redis_sock->autoflush(1);
        $redis_connected = 1;

        # SELECT the session database
        redis_command('SELECT', $REDIS_DB);
    };

    if ($@) {
        radiusd::radlog(1, "session_tracker: Redis connect failed: $@");
        $redis_connected = 0;
        return 0;
    }

    return 1;
}

sub redis_command {
    my @args = @_;

    # Reconnect if needed
    unless ($redis_connected && $redis_sock && $redis_sock->connected()) {
        return undef unless redis_connect();
    }

    # Build RESP command
    my $cmd = "*" . scalar(@args) . "\r\n";
    for my $arg (@args) {
        $arg = '' unless defined $arg;
        $cmd .= "\$" . length($arg) . "\r\n" . $arg . "\r\n";
    }

    eval {
        $redis_sock->print($cmd);
        $redis_sock->flush();
    };
    if ($@) {
        radiusd::radlog(1, "session_tracker: Redis write failed: $@");
        $redis_connected = 0;
        return undef;
    }

    return redis_read_response();
}

sub redis_read_response {
    my $line = $redis_sock->getline();
    unless (defined $line) {
        $redis_connected = 0;
        return undef;
    }
    chomp $line;
    $line =~ s/\r$//;

    my $type = substr($line, 0, 1);
    my $data = substr($line, 1);

    # Simple string (+OK)
    if ($type eq '+') {
        return $data;
    }
    # Error (-ERR ...)
    elsif ($type eq '-') {
        radiusd::radlog(1, "session_tracker: Redis error: $data");
        return undef;
    }
    # Integer (:N)
    elsif ($type eq ':') {
        return int($data);
    }
    # Bulk string ($N)
    elsif ($type eq '$') {
        my $len = int($data);
        return undef if $len < 0;  # $-1 = nil
        my $buf = '';
        while (length($buf) < $len + 2) {
            my $chunk;
            $redis_sock->read($chunk, $len + 2 - length($buf));
            $buf .= $chunk;
        }
        return substr($buf, 0, $len);
    }
    # Array (*N)
    elsif ($type eq '*') {
        my $count = int($data);
        return [] if $count <= 0;
        my @results;
        for (1 .. $count) {
            push @results, redis_read_response();
        }
        return \@results;
    }

    return undef;
}

# Pipeline: send multiple commands, read all responses
sub redis_pipeline {
    my @commands = @_;

    unless ($redis_connected && $redis_sock && $redis_sock->connected()) {
        return () unless redis_connect();
    }

    # Build and send all commands at once
    my $bulk = '';
    for my $cmd_ref (@commands) {
        my @args = @$cmd_ref;
        $bulk .= "*" . scalar(@args) . "\r\n";
        for my $arg (@args) {
            $arg = '' unless defined $arg;
            $bulk .= "\$" . length($arg) . "\r\n" . $arg . "\r\n";
        }
    }

    eval {
        $redis_sock->print($bulk);
        $redis_sock->flush();
    };
    if ($@) {
        radiusd::radlog(1, "session_tracker: Redis pipeline write failed: $@");
        $redis_connected = 0;
        return ();
    }

    # Read all responses
    my @responses;
    for (1 .. scalar(@commands)) {
        push @responses, redis_read_response();
    }

    return @responses;
}

# ============================================================================
# FreeRADIUS rlm_perl Entry Points
# ============================================================================

# Called once when the module is loaded
sub instantiate {
    radiusd::radlog(0, "session_tracker: Enterprise Redis session tracker initialized");
    radiusd::radlog(0, "session_tracker: Redis=$REDIS_HOST:$REDIS_PORT DB=$REDIS_DB TTL=${DEFAULT_TTL}s");
    return RLM_MODULE_OK;
}

# Called on every accounting packet
sub accounting {
    # Extract attributes from the RADIUS request
    my $acct_type    = $RAD_REQUEST{'Acct-Status-Type'}       // '';
    my $session_id   = $RAD_REQUEST{'Acct-Session-Id'}        // '';
    my $username     = $RAD_REQUEST{'User-Name'}              // '';
    my $nas_ip       = $RAD_REQUEST{'NAS-IP-Address'}         // '';
    my $framed_ip    = $RAD_REQUEST{'Framed-IP-Address'}      // '';
    my $session_time = $RAD_REQUEST{'Acct-Session-Time'}      // 0;
    my $input_oct    = $RAD_REQUEST{'Acct-Input-Octets'}      // 0;
    my $output_oct   = $RAD_REQUEST{'Acct-Output-Octets'}     // 0;
    my $input_giga   = $RAD_REQUEST{'Acct-Input-Gigawords'}   // 0;
    my $output_giga  = $RAD_REQUEST{'Acct-Output-Gigawords'}  // 0;
    my $nas_port     = $RAD_REQUEST{'NAS-Port-ID'}            // $RAD_REQUEST{'NAS-Port'} // '';
    my $called_id    = $RAD_REQUEST{'Called-Station-Id'}       // '';
    my $calling_id   = $RAD_REQUEST{'Calling-Station-Id'}     // '';
    my $term_cause   = $RAD_REQUEST{'Acct-Terminate-Cause'}   // '';
    my $interim_int  = $RAD_REQUEST{'Acct-Interim-Interval'}  // 0;

    # Calculate gigaword-adjusted totals
    my $total_input  = ($input_giga * 4294967296) + $input_oct;
    my $total_output = ($output_giga * 4294967296) + $output_oct;

    # Calculate TTL: 2× interim interval + 60s grace, or default
    my $ttl = $DEFAULT_TTL;
    if ($interim_int > 0) {
        $ttl = ($interim_int * 2) + 60;
        $ttl = $MAX_TTL if $ttl > $MAX_TTL;
    }

    # Route to handler based on accounting event type
    if ($acct_type eq 'Start') {
        return handle_start($session_id, $username, $nas_ip, $framed_ip,
                           $called_id, $calling_id, $nas_port, $ttl);
    }
    elsif ($acct_type eq 'Interim-Update') {
        return handle_interim($session_id, $username, $nas_ip, $framed_ip,
                             $session_time, $total_input, $total_output,
                             $called_id, $calling_id, $ttl);
    }
    elsif ($acct_type eq 'Stop') {
        return handle_stop($session_id, $username, $nas_ip, $term_cause,
                          $session_time, $total_input, $total_output);
    }
    elsif ($acct_type eq 'Accounting-On' || $acct_type eq 'Accounting-Off') {
        return handle_nas_event($nas_ip, $acct_type);
    }

    return RLM_MODULE_NOOP;
}

# ============================================================================
# Event Handlers
# ============================================================================

sub handle_start {
    my ($session_id, $username, $nas_ip, $framed_ip,
        $called_id, $calling_id, $nas_port, $ttl) = @_;

    return RLM_MODULE_NOOP unless $session_id && $username;

    my $session_key = "session:${nas_ip}:${session_id}";
    my $now = time();

    # Pipeline: create session + register in all sets + set TTLs
    my @cmds = (
        # Create session hash with all attributes
        ['HSET', $session_key,
            'username',       $username,
            'session_id',     $session_id,
            'nas_ip',         $nas_ip,
            'framed_ip',      $framed_ip,
            'called_id',      $called_id,
            'calling_id',     $calling_id,
            'nas_port',       $nas_port,
            'session_time',   0,
            'input_bytes',    0,
            'output_bytes',   0,
            'start_time',     $now,
            'last_update',    $now,
            'event_type',     'start',
        ],
        # Set TTL on session (stale detection)
        ['EXPIRE', $session_key, $ttl],
        # Add session to user's session set
        ['SADD', "user:sessions:${username}", $session_key],
        ['EXPIRE', "user:sessions:${username}", $MAX_TTL],
        # Add session to NAS's session set
        ['SADD', "nas:sessions:${nas_ip}", $session_key],
        ['EXPIRE', "nas:sessions:${nas_ip}", $MAX_TTL],
        # Add user to global online set
        ['SADD', 'online:users', $username],
    );

    redis_pipeline(@cmds);

    radiusd::radlog(0, "session_tracker: START $username session=$session_id nas=$nas_ip ip=$framed_ip ttl=${ttl}s");
    return RLM_MODULE_OK;
}

sub handle_interim {
    my ($session_id, $username, $nas_ip, $framed_ip,
        $session_time, $total_input, $total_output,
        $called_id, $calling_id, $ttl) = @_;

    return RLM_MODULE_NOOP unless $session_id && $username;

    my $session_key = "session:${nas_ip}:${session_id}";
    my $now = time();

    # Pipeline: update session data + refresh all TTLs
    my @cmds = (
        # Update session with latest traffic/time
        ['HSET', $session_key,
            'username',      $username,
            'session_id',    $session_id,
            'nas_ip',        $nas_ip,
            'framed_ip',     $framed_ip,
            'called_id',     $called_id,
            'calling_id',    $calling_id,
            'session_time',  $session_time,
            'input_bytes',   $total_input,
            'output_bytes',  $total_output,
            'last_update',   $now,
            'event_type',    'interim',
        ],
        # Refresh TTL (resets the stale detection clock)
        ['EXPIRE', $session_key, $ttl],
        # Ensure set memberships exist (idempotent)
        ['SADD', "user:sessions:${username}", $session_key],
        ['EXPIRE', "user:sessions:${username}", $MAX_TTL],
        ['SADD', "nas:sessions:${nas_ip}", $session_key],
        ['EXPIRE', "nas:sessions:${nas_ip}", $MAX_TTL],
        ['SADD', 'online:users', $username],
    );

    redis_pipeline(@cmds);

    radiusd::radlog(0, "session_tracker: INTERIM $username session=$session_id time=${session_time}s in=$total_input out=$total_output ttl=${ttl}s");
    return RLM_MODULE_OK;
}

sub handle_stop {
    my ($session_id, $username, $nas_ip, $term_cause,
        $session_time, $total_input, $total_output) = @_;

    return RLM_MODULE_NOOP unless $session_id && $username;

    my $session_key = "session:${nas_ip}:${session_id}";

    # Pipeline: remove session + clean up sets
    my @cmds = (
        # Delete the session hash
        ['DEL', $session_key],
        # Remove from user's session set
        ['SREM', "user:sessions:${username}", $session_key],
        # Remove from NAS's session set
        ['SREM', "nas:sessions:${nas_ip}", $session_key],
    );

    redis_pipeline(@cmds);

    # Check if user has any remaining sessions — if not, remove from online set
    my $remaining = redis_command('SCARD', "user:sessions:${username}");
    if (!$remaining || $remaining == 0) {
        redis_command('SREM', 'online:users', $username);
        redis_command('DEL', "user:sessions:${username}");
    }

    radiusd::radlog(0, "session_tracker: STOP $username session=$session_id cause=$term_cause time=${session_time}s in=$total_input out=$total_output");
    return RLM_MODULE_OK;
}

sub handle_nas_event {
    my ($nas_ip, $event_type) = @_;

    return RLM_MODULE_NOOP unless $nas_ip;

    # Get all sessions for this NAS
    my $sessions = redis_command('SMEMBERS', "nas:sessions:${nas_ip}");

    if ($sessions && ref($sessions) eq 'ARRAY' && @$sessions) {
        my $count = scalar @$sessions;

        for my $session_key (@$sessions) {
            next unless $session_key;

            # Get the username from the session hash before deleting
            my $username = redis_command('HGET', $session_key, 'username');

            # Delete the session
            redis_command('DEL', $session_key);

            # Remove from user's session set
            if ($username) {
                redis_command('SREM', "user:sessions:${username}", $session_key);
                # Check if user has remaining sessions
                my $remaining = redis_command('SCARD', "user:sessions:${username}");
                if (!$remaining || $remaining == 0) {
                    redis_command('SREM', 'online:users', $username);
                    redis_command('DEL', "user:sessions:${username}");
                }
            }
        }

        # Clean up the NAS session set
        redis_command('DEL', "nas:sessions:${nas_ip}");

        radiusd::radlog(0, "session_tracker: $event_type nas=$nas_ip cleared $count sessions");
    }
    else {
        radiusd::radlog(0, "session_tracker: $event_type nas=$nas_ip (no active sessions)");
    }

    return RLM_MODULE_OK;
}

# ============================================================================
# Other rlm_perl hooks (required but not used for accounting)
# ============================================================================
sub authorize    { return RLM_MODULE_OK; }
sub authenticate { return RLM_MODULE_OK; }
sub preacct      { return RLM_MODULE_OK; }
sub post_auth    { return RLM_MODULE_OK; }
sub detach       {
    if ($redis_sock) {
        eval { $redis_sock->close(); };
    }
    radiusd::radlog(0, "session_tracker: Detached, Redis connection closed");
    return RLM_MODULE_OK;
}

1;  # Perl modules must return true
