#!/bin/bash

# Heavy Load RADIUS Accounting Test
# Generates massive amounts of accounting data concurrently

RADIUS_SERVER="localhost"
RADIUS_PORT="1813"
RADIUS_SECRET="testing123"
NAS_IP="127.0.0.1"

# Number of concurrent sessions to simulate
NUM_SESSIONS=${1:-50}
MAX_PARALLEL=${2:-10}

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=========================================="
echo "HEAVY LOAD ACCOUNTING TEST"
echo "==========================================${NC}"
echo "Sessions to create: $NUM_SESSIONS"
echo "Max parallel: $MAX_PARALLEL"
echo ""

# Quick session simulation (no interim updates for speed)
quick_session() {
    local username=$1
    local session_id=$2
    local nas_port=$3
    
    # Random session duration (5 min to 4 hours)
    local duration=$((RANDOM % 14100 + 300))
    
    # Random data usage (100MB to 10GB)
    local input_octets=$((RANDOM % 10000000000 + 100000000))
    local output_octets=$((RANDOM % 10000000000 + 100000000))
    
    local terminate_causes=("User-Request" "Idle-Timeout" "Session-Timeout" "Admin-Reset" "Lost-Carrier" "NAS-Reboot")
    local cause=${terminate_causes[$RANDOM % ${#terminate_causes[@]}]}
    
    # Start
    cat <<EOF | radclient $RADIUS_SERVER:$RADIUS_PORT acct $RADIUS_SECRET > /dev/null 2>&1
User-Name = "$username"
Acct-Status-Type = Start
Acct-Session-Id = "$session_id"
NAS-IP-Address = $NAS_IP
NAS-Port = $nas_port
Framed-IP-Address = 10.0.$((nas_port / 256)).$((nas_port % 256))
Acct-Authentic = RADIUS
Service-Type = Framed-User
NAS-Port-Type = Ethernet
EOF
    
    # Stop (immediately for speed testing)
    cat <<EOF | radclient $RADIUS_SERVER:$RADIUS_PORT acct $RADIUS_SECRET > /dev/null 2>&1
User-Name = "$username"
Acct-Status-Type = Stop
Acct-Session-Id = "$session_id"
Acct-Session-Time = $duration
NAS-IP-Address = $NAS_IP
NAS-Port = $nas_port
Framed-IP-Address = 10.0.$((nas_port / 256)).$((nas_port % 256))
Acct-Input-Octets = $input_octets
Acct-Output-Octets = $output_octets
Acct-Input-Packets = $((input_octets / 1500))
Acct-Output-Packets = $((output_octets / 1500))
Acct-Terminate-Cause = $cause
Acct-Authentic = RADIUS
Service-Type = Framed-User
NAS-Port-Type = Ethernet
EOF
    
    echo -e "${GREEN}✓${NC} Session $session_id complete (${duration}s, In:${input_octets}, Out:${output_octets})"
}

# Export function for parallel execution
export -f quick_session
export RADIUS_SERVER RADIUS_PORT RADIUS_SECRET NAS_IP GREEN NC

# Generate user list
USERS=("testuser" "al-1-1-11@kt" "al-1-1-12@kt" "al-1-1-13@kt" "al-1-1-14@kt" "al-1-1-15@kt")

echo -e "${BLUE}Generating $NUM_SESSIONS accounting sessions...${NC}"
echo ""

# Create sessions in parallel
START_TIME=$(date +%s)

for i in $(seq 1 $NUM_SESSIONS); do
    # Pick random user
    USER=${USERS[$RANDOM % ${#USERS[@]}]}
    SESSION_ID="load-test-$(date +%s%N)-$i"
    NAS_PORT=$((1000 + i))
    
    # Run in background with parallelism control
    quick_session "$USER" "$SESSION_ID" $NAS_PORT &
    
    # Control parallelism
    if [ $(jobs -r | wc -l) -ge $MAX_PARALLEL ]; then
        wait -n
    fi
done

# Wait for all background jobs to finish
wait

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${YELLOW}=========================================="
echo "TEST COMPLETED"
echo "==========================================${NC}"
echo -e "${GREEN}Sessions created: $NUM_SESSIONS${NC}"
echo -e "${GREEN}Time taken: ${DURATION}s${NC}"
echo -e "${GREEN}Rate: $((NUM_SESSIONS / DURATION)) sessions/second${NC}"
echo ""

# Show statistics
echo -e "${BLUE}Database Statistics:${NC}"
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "
SELECT 
    COUNT(*) as total_sessions,
    COUNT(DISTINCT username) as unique_users,
    SUM(acctsessiontime)::bigint as total_session_time_seconds,
    SUM(acctinputoctets)::bigint as total_input_bytes,
    SUM(acctoutputoctets)::bigint as total_output_bytes,
    pg_size_pretty(pg_total_relation_size('radacct')) as table_size
FROM radacct;"

echo ""
echo -e "${BLUE}Recent Sessions:${NC}"
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "
SELECT username, acctsessionid, acctstarttime, acctstoptime, acctsessiontime, 
       pg_size_pretty(acctinputoctets) as input, 
       pg_size_pretty(acctoutputoctets) as output,
       acctterminatecause
FROM radacct 
ORDER BY acctstarttime DESC 
LIMIT 10;"
