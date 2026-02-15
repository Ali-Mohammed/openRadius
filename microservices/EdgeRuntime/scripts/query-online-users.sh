#!/bin/bash
# ============================================================================
# EdgeRuntime - Redis Online Users Query Tool
# Enterprise real-time session queries against Redis DB 1
#
# Usage:
#   ./query-online-users.sh                 # Show summary dashboard
#   ./query-online-users.sh count           # Online user count
#   ./query-online-users.sh list            # List all online usernames
#   ./query-online-users.sh user <username> # Show user's active sessions
#   ./query-online-users.sh nas <nasip>     # Show sessions on a NAS
#   ./query-online-users.sh session <key>   # Show session detail
#   ./query-online-users.sh cleanup         # Remove stale set entries
#   ./query-online-users.sh flush           # Clear all sessions (DANGER)
# ============================================================================

set -euo pipefail

PROJECT="${COMPOSE_PROJECT_NAME:-edge}"
REDIS_CONTAINER="${PROJECT}_redis"

# Run redis-cli inside the Redis container (DB 1 = sessions)
rcli() {
    docker exec "$REDIS_CONTAINER" redis-cli -n 1 "$@" 2>/dev/null
}

# Format bytes to human readable
format_bytes() {
    local bytes=$1
    if (( bytes >= 1073741824 )); then
        printf "%.2f GiB" "$(echo "scale=2; $bytes / 1073741824" | bc)"
    elif (( bytes >= 1048576 )); then
        printf "%.2f MiB" "$(echo "scale=2; $bytes / 1048576" | bc)"
    elif (( bytes >= 1024 )); then
        printf "%.2f KiB" "$(echo "scale=2; $bytes / 1024" | bc)"
    else
        printf "%d B" "$bytes"
    fi
}

# Format seconds to human readable
format_duration() {
    local secs=$1
    if (( secs >= 86400 )); then
        printf "%dd %dh %dm" $((secs/86400)) $((secs%86400/3600)) $((secs%3600/60))
    elif (( secs >= 3600 )); then
        printf "%dh %dm %ds" $((secs/3600)) $((secs%3600/60)) $((secs%60))
    elif (( secs >= 60 )); then
        printf "%dm %ds" $((secs/60)) $((secs%60))
    else
        printf "%ds" "$secs"
    fi
}

# ============================================================================
# Commands
# ============================================================================

cmd_count() {
    local count
    count=$(rcli SCARD online:users)
    echo "$count"
}

cmd_list() {
    rcli SMEMBERS online:users | sort
}

cmd_user() {
    local username="$1"
    local sessions
    sessions=$(rcli SMEMBERS "user:sessions:${username}")

    if [[ -z "$sessions" ]]; then
        echo "No active sessions for user: $username"
        return
    fi

    echo "══════════════════════════════════════════════════════════════"
    echo "  User: $username"
    echo "══════════════════════════════════════════════════════════════"

    local count=0
    while IFS= read -r session_key; do
        [[ -z "$session_key" ]] && continue

        # Check if session still exists (may have expired via TTL)
        local exists
        exists=$(rcli EXISTS "$session_key")
        if [[ "$exists" != "1" ]]; then
            # Stale entry in user set — session expired via TTL
            rcli SREM "user:sessions:${username}" "$session_key" > /dev/null
            continue
        fi

        count=$((count + 1))

        # Read session hash fields
        local session_id framed_ip calling_id session_time input output event_type last_update
        session_id=$(rcli HGET "$session_key" session_id)
        framed_ip=$(rcli HGET "$session_key" framed_ip)
        calling_id=$(rcli HGET "$session_key" calling_id)
        session_time=$(rcli HGET "$session_key" session_time)
        input=$(rcli HGET "$session_key" input_bytes)
        output=$(rcli HGET "$session_key" output_bytes)
        event_type=$(rcli HGET "$session_key" event_type)
        last_update=$(rcli HGET "$session_key" last_update)
        local nas_ip_val
        nas_ip_val=$(rcli HGET "$session_key" nas_ip)
        local ttl
        ttl=$(rcli TTL "$session_key")

        session_time="${session_time:-0}"
        input="${input:-0}"
        output="${output:-0}"

        echo ""
        echo "  Session #$count: ${session_id:-?}"
        echo "  ├─ NAS:        ${nas_ip_val:-?}"
        echo "  ├─ IP Address: ${framed_ip:-?}"
        echo "  ├─ MAC:        ${calling_id:-?}"
        echo "  ├─ Duration:   $(format_duration "$session_time")"
        echo "  ├─ Download:   $(format_bytes "$input")"
        echo "  ├─ Upload:     $(format_bytes "$output")"
        echo "  ├─ Last Event: ${event_type:-?}"
        echo "  ├─ Last Update:$(date -r "${last_update:-0}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "${last_update:-?}")"
        echo "  └─ TTL:        ${ttl}s ($(format_duration "$ttl") remaining)"
    done <<< "$sessions"

    if [[ $count -eq 0 ]]; then
        echo "  No active sessions (all expired)"
        rcli SREM online:users "$username" > /dev/null
        rcli DEL "user:sessions:${username}" > /dev/null
    else
        echo ""
        echo "  Total: $count active session(s)"
    fi
    echo "══════════════════════════════════════════════════════════════"
}

cmd_nas() {
    local nas_ip="$1"
    local sessions
    sessions=$(rcli SMEMBERS "nas:sessions:${nas_ip}")

    if [[ -z "$sessions" ]]; then
        echo "No active sessions on NAS: $nas_ip"
        return
    fi

    echo "══════════════════════════════════════════════════════════════"
    echo "  NAS: $nas_ip"
    echo "══════════════════════════════════════════════════════════════"

    local count=0
    while IFS= read -r session_key; do
        [[ -z "$session_key" ]] && continue

        local exists
        exists=$(rcli EXISTS "$session_key")
        if [[ "$exists" != "1" ]]; then
            rcli SREM "nas:sessions:${nas_ip}" "$session_key" > /dev/null
            continue
        fi

        count=$((count + 1))
        local username
        username=$(rcli HGET "$session_key" username)
        local framed_ip
        framed_ip=$(rcli HGET "$session_key" framed_ip)
        local session_time
        session_time=$(rcli HGET "$session_key" session_time)
        local event_type
        event_type=$(rcli HGET "$session_key" event_type)

        printf "  %-20s %-16s %10s  %s\n" "$username" "$framed_ip" "$(format_duration "${session_time:-0}")" "$event_type"
    done <<< "$sessions"

    echo ""
    echo "  Total: $count active session(s) on $nas_ip"
    echo "══════════════════════════════════════════════════════════════"
}

cmd_session() {
    local key="$1"
    local exists
    exists=$(rcli EXISTS "$key")
    if [[ "$exists" != "1" ]]; then
        echo "Session not found: $key"
        return 1
    fi

    echo "Session: $key"
    echo "TTL: $(rcli TTL "$key")s"
    echo "---"
    rcli HGETALL "$key" | paste - - | column -t
}

cmd_cleanup() {
    echo "Cleaning up stale set entries..."
    local cleaned=0

    # Clean online:users
    local users
    users=$(rcli SMEMBERS online:users)
    while IFS= read -r username; do
        [[ -z "$username" ]] && continue
        local sessions
        sessions=$(rcli SMEMBERS "user:sessions:${username}")
        local active=0
        while IFS= read -r sk; do
            [[ -z "$sk" ]] && continue
            if [[ "$(rcli EXISTS "$sk")" == "1" ]]; then
                active=$((active + 1))
            else
                rcli SREM "user:sessions:${username}" "$sk" > /dev/null
                cleaned=$((cleaned + 1))
            fi
        done <<< "$sessions"
        if [[ $active -eq 0 ]]; then
            rcli SREM online:users "$username" > /dev/null
            rcli DEL "user:sessions:${username}" > /dev/null
            cleaned=$((cleaned + 1))
        fi
    done <<< "$users"

    # Clean NAS sets
    local nas_keys
    nas_keys=$(rcli KEYS "nas:sessions:*")
    while IFS= read -r nas_key; do
        [[ -z "$nas_key" ]] && continue
        local sessions
        sessions=$(rcli SMEMBERS "$nas_key")
        local active=0
        while IFS= read -r sk; do
            [[ -z "$sk" ]] && continue
            if [[ "$(rcli EXISTS "$sk")" == "1" ]]; then
                active=$((active + 1))
            else
                rcli SREM "$nas_key" "$sk" > /dev/null
                cleaned=$((cleaned + 1))
            fi
        done <<< "$sessions"
        if [[ $active -eq 0 ]]; then
            rcli DEL "$nas_key" > /dev/null
        fi
    done <<< "$nas_keys"

    echo "Cleaned $cleaned stale entries"
}

cmd_flush() {
    echo "⚠️  This will delete ALL session data from Redis DB 1!"
    read -p "Are you sure? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        rcli FLUSHDB
        echo "✓ All session data flushed"
    else
        echo "Cancelled"
    fi
}

cmd_dashboard() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║           EdgeRuntime - Online Users Dashboard              ║"
    echo "╠══════════════════════════════════════════════════════════════╣"

    # Online user count
    local user_count
    user_count=$(rcli SCARD online:users)
    printf "║  Online Users:  %-42s ║\n" "$user_count"

    # Total sessions (count all session:* keys)
    local session_count
    session_count=$(rcli KEYS "session:*" | wc -l | tr -d ' ')
    printf "║  Active Sessions: %-40s ║\n" "$session_count"

    # NAS device count
    local nas_count
    nas_count=$(rcli KEYS "nas:sessions:*" | wc -l | tr -d ' ')
    printf "║  NAS Devices:   %-42s ║\n" "$nas_count"

    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Online Users:                                             ║"
    echo "╠══════════════════════════════════════════════════════════════╣"

    if [[ "$user_count" -gt 0 ]]; then
        local users
        users=$(rcli SMEMBERS online:users | sort)
        while IFS= read -r username; do
            [[ -z "$username" ]] && continue
            local sess_count
            sess_count=$(rcli SCARD "user:sessions:${username}")
            printf "║  %-30s %3s session(s)          ║\n" "$username" "$sess_count"
        done <<< "$users"
    else
        echo "║  (no users online)                                         ║"
    fi

    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

# Check Redis container is running
if ! docker ps --format '{{.Names}}' | grep -q "$REDIS_CONTAINER"; then
    echo "❌ Redis container '$REDIS_CONTAINER' not running"
    exit 1
fi

case "${1:-dashboard}" in
    count)     cmd_count ;;
    list)      cmd_list ;;
    user)      cmd_user "${2:?Usage: $0 user <username>}" ;;
    nas)       cmd_nas "${2:?Usage: $0 nas <nasip>}" ;;
    session)   cmd_session "${2:?Usage: $0 session <key>}" ;;
    cleanup)   cmd_cleanup ;;
    flush)     cmd_flush ;;
    dashboard) cmd_dashboard ;;
    *)
        echo "Usage: $0 {dashboard|count|list|user <name>|nas <ip>|session <key>|cleanup|flush}"
        exit 1
        ;;
esac
