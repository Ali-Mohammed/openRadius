#!/bin/bash
# ============================================================================
# Enterprise Redis Online Users Query Tool v2.0
# Uses SCAN (not KEYS) and atomic counters for O(1) dashboard queries
# ============================================================================

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6380}"
REDIS_DB="${REDIS_DB:-1}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================================
# Redis Helpers
# ============================================================================

redis_cmd() {
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DB" "$@" 2>/dev/null
}

# SCAN-based key iteration - replaces KEYS for O(N) safety
# Usage: redis_scan "pattern" callback_function
redis_scan_keys() {
    local pattern="$1"
    local cursor="0"
    local all_keys=""

    while true; do
        local result
        result=$(redis_cmd SCAN "$cursor" MATCH "$pattern" COUNT 100)

        # Parse cursor and keys from SCAN response
        local new_cursor
        new_cursor=$(echo "$result" | head -1)
        local keys
        keys=$(echo "$result" | tail -n +2)

        if [ -n "$keys" ]; then
            if [ -n "$all_keys" ]; then
                all_keys="${all_keys}
${keys}"
            else
                all_keys="$keys"
            fi
        fi

        cursor="$new_cursor"
        if [ "$cursor" = "0" ]; then
            break
        fi
    done

    echo "$all_keys"
}

format_bytes() {
    local bytes=$1
    if [ "$bytes" -ge 1073741824 ] 2>/dev/null; then
        echo "$(echo "scale=2; $bytes / 1073741824" | bc) GB"
    elif [ "$bytes" -ge 1048576 ] 2>/dev/null; then
        echo "$(echo "scale=2; $bytes / 1048576" | bc) MB"
    elif [ "$bytes" -ge 1024 ] 2>/dev/null; then
        echo "$(echo "scale=2; $bytes / 1024" | bc) KB"
    else
        echo "${bytes} B"
    fi
}

format_time() {
    local seconds=$1
    if [ "$seconds" -ge 86400 ] 2>/dev/null; then
        local days=$((seconds / 86400))
        local hours=$(( (seconds % 86400) / 3600 ))
        echo "${days}d ${hours}h"
    elif [ "$seconds" -ge 3600 ] 2>/dev/null; then
        local hours=$((seconds / 3600))
        local mins=$(( (seconds % 3600) / 60 ))
        echo "${hours}h ${mins}m"
    elif [ "$seconds" -ge 60 ] 2>/dev/null; then
        local mins=$((seconds / 60))
        local secs=$((seconds % 60))
        echo "${mins}m ${secs}s"
    else
        echo "${seconds}s"
    fi
}

# ============================================================================
# Dashboard - O(1) from atomic counters
# ============================================================================

cmd_dashboard() {
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}   EdgeRuntime Online Users Dashboard  ${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
    echo ""

    # O(1) atomic counters - no KEYS/SCAN needed
    local session_count
    session_count=$(redis_cmd GET "online:count:sessions" 2>/dev/null)
    session_count=${session_count:-0}

    local user_count
    user_count=$(redis_cmd GET "online:count:users" 2>/dev/null)
    user_count=${user_count:-0}

    # Fallback to SCARD if counters not initialized
    if [ "$user_count" = "0" ] || [ -z "$user_count" ]; then
        user_count=$(redis_cmd SCARD "online:users" 2>/dev/null)
        user_count=${user_count:-0}
    fi

    # Correct negative counter drift (can happen after flush/restart)
    if [ "$session_count" -lt 0 ] 2>/dev/null; then
        session_count=0
    fi
    if [ "$user_count" -lt 0 ] 2>/dev/null; then
        user_count=0
    fi

    echo -e "  ${GREEN}●${NC} Online Users:    ${BOLD}${user_count}${NC}"
    echo -e "  ${GREEN}●${NC} Active Sessions: ${BOLD}${session_count}${NC}"

    # NAS count via SCAN (not KEYS)
    local nas_keys
    nas_keys=$(redis_scan_keys "nas:sessions:*")
    local nas_count=0
    if [ -n "$nas_keys" ]; then
        nas_count=$(echo "$nas_keys" | wc -l | tr -d ' ')
    fi
    echo -e "  ${GREEN}●${NC} Active NAS:      ${BOLD}${nas_count}${NC}"
    echo ""

    # List NAS devices
    if [ "$nas_count" -gt 0 ]; then
        echo -e "  ${YELLOW}NAS Devices:${NC}"
        echo "$nas_keys" | while IFS= read -r nas_key; do
            local nasip
            nasip=$(echo "$nas_key" | sed 's/nas:sessions://')
            local count
            count=$(redis_cmd SCARD "$nas_key" 2>/dev/null)
            count=${count:-0}
            echo -e "    ${nasip}: ${count} sessions"
        done
    fi

    echo ""
    echo -e "  ${CYAN}Counters: sessions=${session_count} users=${user_count} (atomic O(1))${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
}

# ============================================================================
# Count - O(1) from counters
# ============================================================================

cmd_count() {
    local session_count
    session_count=$(redis_cmd GET "online:count:sessions" 2>/dev/null)
    session_count=${session_count:-0}

    local user_count
    user_count=$(redis_cmd GET "online:count:users" 2>/dev/null)
    user_count=${user_count:-0}

    if [ "$session_count" -lt 0 ] 2>/dev/null; then session_count=0; fi
    if [ "$user_count" -lt 0 ] 2>/dev/null; then user_count=0; fi

    echo "Online Users: $user_count"
    echo "Active Sessions: $session_count"
}

# ============================================================================
# List all sessions using SCAN
# ============================================================================

cmd_list() {
    echo -e "${BOLD}Active Sessions:${NC}"
    echo ""

    local session_keys
    session_keys=$(redis_scan_keys "session:*")

    if [ -z "$session_keys" ]; then
        echo -e "  ${YELLOW}No active sessions${NC}"
        return
    fi

    local total=0
    echo "$session_keys" | while IFS= read -r key; do
        [ -z "$key" ] && continue

        local username nasip framed_ip session_time input_bytes output_bytes
        username=$(redis_cmd HGET "$key" username 2>/dev/null)
        nasip=$(redis_cmd HGET "$key" nas_ip 2>/dev/null)
        framed_ip=$(redis_cmd HGET "$key" framed_ip 2>/dev/null)
        session_time=$(redis_cmd HGET "$key" session_time 2>/dev/null)
        input_bytes=$(redis_cmd HGET "$key" input_bytes 2>/dev/null)
        output_bytes=$(redis_cmd HGET "$key" output_bytes 2>/dev/null)

        session_time=${session_time:-0}
        input_bytes=${input_bytes:-0}
        output_bytes=${output_bytes:-0}

        local ttl
        ttl=$(redis_cmd TTL "$key" 2>/dev/null)

        echo -e "  ${GREEN}●${NC} ${BOLD}${username:-unknown}${NC}"
        echo -e "    IP: ${framed_ip:-N/A}  NAS: ${nasip:-N/A}"
        echo -e "    Time: $(format_time "$session_time")  ↓$(format_bytes "$input_bytes") ↑$(format_bytes "$output_bytes")"
        echo -e "    TTL: ${ttl}s  Key: ${key}"
        echo ""
    done
}

# ============================================================================
# User details with lazy cleanup
# ============================================================================

cmd_user() {
    local username="$1"
    if [ -z "$username" ]; then
        echo "Usage: $0 user <username>"
        exit 1
    fi

    echo -e "${BOLD}Sessions for user: ${username}${NC}"
    echo ""

    local members
    members=$(redis_cmd SMEMBERS "user:sessions:${username}" 2>/dev/null)

    if [ -z "$members" ]; then
        echo -e "  ${YELLOW}No sessions found for ${username}${NC}"
        return
    fi

    local active=0
    local stale=0

    echo "$members" | while IFS= read -r key; do
        [ -z "$key" ] && continue

        local exists
        exists=$(redis_cmd EXISTS "$key" 2>/dev/null)

        if [ "$exists" = "1" ]; then
            active=$((active + 1))

            local session_id framed_ip nas_ip session_time input_bytes output_bytes ttl
            session_id=$(redis_cmd HGET "$key" session_id 2>/dev/null)
            framed_ip=$(redis_cmd HGET "$key" framed_ip 2>/dev/null)
            nas_ip=$(redis_cmd HGET "$key" nas_ip 2>/dev/null)
            session_time=$(redis_cmd HGET "$key" session_time 2>/dev/null)
            input_bytes=$(redis_cmd HGET "$key" input_bytes 2>/dev/null)
            output_bytes=$(redis_cmd HGET "$key" output_bytes 2>/dev/null)
            ttl=$(redis_cmd TTL "$key" 2>/dev/null)

            session_time=${session_time:-0}
            input_bytes=${input_bytes:-0}
            output_bytes=${output_bytes:-0}

            echo -e "  ${GREEN}●${NC} Session: ${session_id}"
            echo -e "    IP: ${framed_ip:-N/A}  NAS: ${nas_ip:-N/A}"
            echo -e "    Time: $(format_time "$session_time")  ↓$(format_bytes "$input_bytes") ↑$(format_bytes "$output_bytes")"
            echo -e "    TTL: ${ttl}s"
            echo ""
        else
            stale=$((stale + 1))
            # Lazy cleanup: remove stale entry from set
            redis_cmd SREM "user:sessions:${username}" "$key" > /dev/null 2>&1
            redis_cmd DECR "online:count:sessions" > /dev/null 2>&1

            # Remove from NAS set too
            local nasip
            nasip=$(echo "$key" | sed -n 's/^session:\([^:]*\):.*/\1/p')
            if [ -n "$nasip" ]; then
                redis_cmd SREM "nas:sessions:${nasip}" "$key" > /dev/null 2>&1
            fi
        fi
    done

    # If we pruned stale entries, re-check user membership
    local remaining
    remaining=$(redis_cmd SCARD "user:sessions:${username}" 2>/dev/null)
    remaining=${remaining:-0}
    if [ "$remaining" = "0" ]; then
        redis_cmd SREM "online:users" "$username" > /dev/null 2>&1
        redis_cmd DEL "user:sessions:${username}" > /dev/null 2>&1
        redis_cmd DECR "online:count:users" > /dev/null 2>&1
    fi
}

# ============================================================================
# NAS details with lazy cleanup
# ============================================================================

cmd_nas() {
    local nasip="$1"
    if [ -z "$nasip" ]; then
        echo -e "${BOLD}NAS Devices (via SCAN):${NC}"
        echo ""

        local nas_keys
        nas_keys=$(redis_scan_keys "nas:sessions:*")

        if [ -z "$nas_keys" ]; then
            echo -e "  ${YELLOW}No active NAS devices${NC}"
            return
        fi

        echo "$nas_keys" | while IFS= read -r key; do
            local ip
            ip=$(echo "$key" | sed 's/nas:sessions://')
            local count
            count=$(redis_cmd SCARD "$key" 2>/dev/null)
            echo -e "  ${GREEN}●${NC} NAS: ${ip}  Sessions: ${count}"
        done
        return
    fi

    echo -e "${BOLD}Sessions for NAS: ${nasip}${NC}"
    echo ""

    local members
    members=$(redis_cmd SMEMBERS "nas:sessions:${nasip}" 2>/dev/null)

    if [ -z "$members" ]; then
        echo -e "  ${YELLOW}No sessions found for NAS ${nasip}${NC}"
        return
    fi

    echo "$members" | while IFS= read -r key; do
        [ -z "$key" ] && continue

        local exists
        exists=$(redis_cmd EXISTS "$key" 2>/dev/null)

        if [ "$exists" = "1" ]; then
            local username framed_ip session_time ttl
            username=$(redis_cmd HGET "$key" username 2>/dev/null)
            framed_ip=$(redis_cmd HGET "$key" framed_ip 2>/dev/null)
            session_time=$(redis_cmd HGET "$key" session_time 2>/dev/null)
            ttl=$(redis_cmd TTL "$key" 2>/dev/null)
            session_time=${session_time:-0}

            echo -e "  ${GREEN}●${NC} ${BOLD}${username:-unknown}${NC}  IP: ${framed_ip:-N/A}  Time: $(format_time "$session_time")  TTL: ${ttl}s"
        else
            # Lazy cleanup: remove stale entry from NAS set
            redis_cmd SREM "nas:sessions:${nasip}" "$key" > /dev/null 2>&1
        fi
    done
}

# ============================================================================
# Session detail
# ============================================================================

cmd_session() {
    local session_id="$1"
    if [ -z "$session_id" ]; then
        echo "Usage: $0 session <session_id>"
        exit 1
    fi

    # SCAN for the session key (format: session:{nasip}:{sessionid})
    local session_keys
    session_keys=$(redis_scan_keys "session:*:${session_id}")

    if [ -z "$session_keys" ]; then
        echo -e "${YELLOW}Session ${session_id} not found${NC}"
        return
    fi

    echo "$session_keys" | while IFS= read -r key; do
        [ -z "$key" ] && continue

        echo -e "${BOLD}Session Detail: ${key}${NC}"
        echo ""

        local all_fields
        all_fields=$(redis_cmd HGETALL "$key" 2>/dev/null)

        if [ -z "$all_fields" ]; then
            echo -e "  ${YELLOW}Session data not found${NC}"
            continue
        fi

        # Print fields in pairs
        local field_name=""
        echo "$all_fields" | while IFS= read -r line; do
            if [ -z "$field_name" ]; then
                field_name="$line"
            else
                printf "  %-15s %s\n" "${field_name}:" "$line"
                field_name=""
            fi
        done

        local ttl
        ttl=$(redis_cmd TTL "$key" 2>/dev/null)
        echo ""
        echo -e "  TTL: ${ttl}s"
    done
}

# ============================================================================
# Cleanup - full scan and prune all stale entries + recalculate counters
# ============================================================================

cmd_cleanup() {
    echo -e "${BOLD}Running full cleanup (SCAN-based)...${NC}"
    echo ""

    local total_pruned=0
    local actual_sessions=0
    local actual_users=0

    # Scan all user:sessions:* sets
    local user_set_keys
    user_set_keys=$(redis_scan_keys "user:sessions:*")

    if [ -n "$user_set_keys" ]; then
        echo "$user_set_keys" | while IFS= read -r set_key; do
            [ -z "$set_key" ] && continue

            local username
            username=$(echo "$set_key" | sed 's/user:sessions://')

            local members
            members=$(redis_cmd SMEMBERS "$set_key" 2>/dev/null)

            if [ -n "$members" ]; then
                echo "$members" | while IFS= read -r session_key; do
                    [ -z "$session_key" ] && continue
                    local exists
                    exists=$(redis_cmd EXISTS "$session_key" 2>/dev/null)
                    if [ "$exists" != "1" ]; then
                        redis_cmd SREM "$set_key" "$session_key" > /dev/null 2>&1
                        # Remove from NAS set too
                        local nasip
                        nasip=$(echo "$session_key" | sed -n 's/^session:\([^:]*\):.*/\1/p')
                        if [ -n "$nasip" ]; then
                            redis_cmd SREM "nas:sessions:${nasip}" "$session_key" > /dev/null 2>&1
                        fi
                        echo -e "  ${RED}✗${NC} Pruned stale: ${session_key} (user: ${username})"
                    fi
                done
            fi

            # Check if user set is now empty
            local remaining
            remaining=$(redis_cmd SCARD "$set_key" 2>/dev/null)
            remaining=${remaining:-0}
            if [ "$remaining" = "0" ]; then
                redis_cmd DEL "$set_key" > /dev/null 2>&1
                redis_cmd SREM "online:users" "$username" > /dev/null 2>&1
                echo -e "  ${RED}✗${NC} Removed empty user set: ${username}"
            fi
        done
    fi

    # Clean up empty NAS sets
    local nas_set_keys
    nas_set_keys=$(redis_scan_keys "nas:sessions:*")
    if [ -n "$nas_set_keys" ]; then
        echo "$nas_set_keys" | while IFS= read -r set_key; do
            [ -z "$set_key" ] && continue
            local remaining
            remaining=$(redis_cmd SCARD "$set_key" 2>/dev/null)
            remaining=${remaining:-0}
            if [ "$remaining" = "0" ]; then
                redis_cmd DEL "$set_key" > /dev/null 2>&1
            fi
        done
    fi

    echo ""
    echo -e "${BOLD}Recalculating atomic counters from actual data...${NC}"

    # Count actual live sessions via SCAN
    local session_keys
    session_keys=$(redis_scan_keys "session:*")
    if [ -n "$session_keys" ]; then
        actual_sessions=$(echo "$session_keys" | wc -l | tr -d ' ')
    fi

    # Count actual online users from the set
    actual_users=$(redis_cmd SCARD "online:users" 2>/dev/null)
    actual_users=${actual_users:-0}

    # Recalibrate counters
    redis_cmd SET "online:count:sessions" "$actual_sessions" > /dev/null 2>&1
    redis_cmd SET "online:count:users" "$actual_users" > /dev/null 2>&1

    echo -e "  ${GREEN}✓${NC} Counters recalibrated: sessions=${actual_sessions} users=${actual_users}"
    echo ""
    echo -e "${GREEN}Cleanup complete.${NC}"
}

# ============================================================================
# Flush - clear all session data
# ============================================================================

cmd_flush() {
    echo -e "${RED}${BOLD}WARNING: This will delete ALL session tracking data from Redis DB $REDIS_DB${NC}"
    read -r -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        redis_cmd FLUSHDB > /dev/null 2>&1
        echo -e "${GREEN}Redis DB $REDIS_DB flushed.${NC}"
    else
        echo "Cancelled."
    fi
}

# ============================================================================
# Main
# ============================================================================

usage() {
    echo -e "${BOLD}EdgeRuntime Online Users Query Tool v2.0${NC}"
    echo ""
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  dashboard         Show overview with O(1) atomic counters"
    echo "  count             Show session/user counts (O(1))"
    echo "  list              List all active sessions (SCAN-based)"
    echo "  user <username>   Show sessions for a user (with lazy cleanup)"
    echo "  nas [nasip]       Show NAS devices or sessions for a NAS"
    echo "  session <id>      Show detailed session info"
    echo "  cleanup           Full scan: prune stale entries + recalibrate counters"
    echo "  flush             Delete all session data (DANGEROUS)"
    echo ""
    echo "Environment:"
    echo "  REDIS_HOST=$REDIS_HOST  REDIS_PORT=$REDIS_PORT  REDIS_DB=$REDIS_DB"
    echo ""
    echo "Enterprise features:"
    echo "  - Atomic O(1) counters for dashboard/count (no KEYS blocking)"
    echo "  - SCAN-based iteration (safe for 100K+ sessions)"
    echo "  - Lazy cleanup on user/NAS queries"
    echo "  - Full recalibration via cleanup command"
}

case "${1:-}" in
    dashboard) cmd_dashboard ;;
    count)     cmd_count ;;
    list)      cmd_list ;;
    user)      cmd_user "$2" ;;
    nas)       cmd_nas "$2" ;;
    session)   cmd_session "$2" ;;
    cleanup)   cmd_cleanup ;;
    flush)     cmd_flush ;;
    *)         usage ;;
esac
