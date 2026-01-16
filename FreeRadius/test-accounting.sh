#!/bin/bash

# Heavy RADIUS Accounting Testing Script
# Generates realistic accounting data for testing

RADIUS_SERVER="localhost"
RADIUS_PORT="1813"
RADIUS_SECRET="testing123"
NAS_IP="127.0.0.1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting RADIUS Accounting Heavy Test${NC}"
echo "======================================"

# Function to send accounting start
send_acct_start() {
    local username=$1
    local session_id=$2
    local nas_port=$3
    
    echo -e "${GREEN}[START]${NC} Session $session_id for user $username"
    
    cat <<EOF | radclient -x $RADIUS_SERVER:$RADIUS_PORT acct $RADIUS_SECRET
User-Name = "$username"
Acct-Status-Type = Start
Acct-Session-Id = "$session_id"
NAS-IP-Address = $NAS_IP
NAS-Port = $nas_port
Framed-IP-Address = 10.0.0.$nas_port
Acct-Authentic = RADIUS
Service-Type = Framed-User
NAS-Port-Type = Ethernet
Called-Station-Id = "00:11:22:33:44:55"
Calling-Station-Id = "AA:BB:CC:DD:EE:FF"
EOF
}

# Function to send accounting interim update
send_acct_interim() {
    local username=$1
    local session_id=$2
    local nas_port=$3
    local session_time=$4
    local input_octets=$5
    local output_octets=$6
    
    echo -e "${BLUE}[UPDATE]${NC} Session $session_id - Time: ${session_time}s, In: ${input_octets}, Out: ${output_octets}"
    
    cat <<EOF | radclient $RADIUS_SERVER:$RADIUS_PORT acct $RADIUS_SECRET
User-Name = "$username"
Acct-Status-Type = Interim-Update
Acct-Session-Id = "$session_id"
Acct-Session-Time = $session_time
NAS-IP-Address = $NAS_IP
NAS-Port = $nas_port
Framed-IP-Address = 10.0.0.$nas_port
Acct-Input-Octets = $input_octets
Acct-Output-Octets = $output_octets
Acct-Input-Packets = $((input_octets / 1500))
Acct-Output-Packets = $((output_octets / 1500))
Acct-Authentic = RADIUS
Service-Type = Framed-User
NAS-Port-Type = Ethernet
EOF
}

# Function to send accounting stop
send_acct_stop() {
    local username=$1
    local session_id=$2
    local nas_port=$3
    local session_time=$4
    local input_octets=$5
    local output_octets=$6
    local terminate_cause=$7
    
    echo -e "${GREEN}[STOP]${NC} Session $session_id - Total Time: ${session_time}s, Total In: ${input_octets}, Total Out: ${output_octets}"
    
    cat <<EOF | radclient $RADIUS_SERVER:$RADIUS_PORT acct $RADIUS_SECRET
User-Name = "$username"
Acct-Status-Type = Stop
Acct-Session-Id = "$session_id"
Acct-Session-Time = $session_time
NAS-IP-Address = $NAS_IP
NAS-Port = $nas_port
Framed-IP-Address = 10.0.0.$nas_port
Acct-Input-Octets = $input_octets
Acct-Output-Octets = $output_octets
Acct-Input-Packets = $((input_octets / 1500))
Acct-Output-Packets = $((output_octets / 1500))
Acct-Terminate-Cause = $terminate_cause
Acct-Authentic = RADIUS
Service-Type = Framed-User
NAS-Port-Type = Ethernet
Called-Station-Id = "00:11:22:33:44:55"
Calling-Station-Id = "AA:BB:CC:DD:EE:FF"
EOF
}

# Simulate a complete session
simulate_session() {
    local username=$1
    local session_id=$2
    local nas_port=$3
    local duration=$4
    
    echo ""
    echo "=========================================="
    echo "Simulating session for $username"
    echo "Session ID: $session_id"
    echo "Duration: ${duration}s"
    echo "=========================================="
    
    # Start
    send_acct_start "$username" "$session_id" $nas_port
    sleep 1
    
    # Interim updates every 30% of duration
    local interval=$((duration / 3))
    local time_elapsed=$interval
    local bytes_in=$((RANDOM * 1000000))
    local bytes_out=$((RANDOM * 2000000))
    
    for i in 1 2; do
        send_acct_interim "$username" "$session_id" $nas_port $time_elapsed $bytes_in $bytes_out
        sleep 1
        time_elapsed=$((time_elapsed + interval))
        bytes_in=$((bytes_in + RANDOM * 1000000))
        bytes_out=$((bytes_out + RANDOM * 2000000))
    done
    
    # Stop
    local terminate_causes=("User-Request" "Idle-Timeout" "Session-Timeout" "Admin-Reset" "Lost-Carrier")
    local cause=${terminate_causes[$RANDOM % ${#terminate_causes[@]}]}
    send_acct_stop "$username" "$session_id" $nas_port $duration $bytes_in $bytes_out "$cause"
    sleep 1
}

# Main test execution
echo ""
echo "Generating test accounting data..."
echo ""

# Test with testuser
SESSION_ID=$(date +%s)
simulate_session "testuser" "session-${SESSION_ID}-1" 100 3600

# Test with existing users from database
USERS=("al-1-1-11@kt" "al-1-1-12@kt" "al-1-1-13@kt" "al-1-1-14@kt")
PORT=101

for user in "${USERS[@]}"; do
    SESSION_ID=$(date +%s)-$PORT
    DURATION=$((RANDOM % 7200 + 1800)) # Random duration between 30 min and 2 hours
    simulate_session "$user" "session-$SESSION_ID" $PORT $DURATION
    PORT=$((PORT + 1))
    sleep 2
done

echo ""
echo -e "${GREEN}======================================"
echo "Accounting test completed!"
echo "======================================${NC}"
echo ""
echo "Check the accounting data with:"
echo "  docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c \"SELECT * FROM radacct ORDER BY acctstarttime DESC LIMIT 10;\""
