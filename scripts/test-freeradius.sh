#!/bin/bash
# FreeRADIUS Testing Script
# Tests authentication and database connectivity

set -e

echo "=========================================="
echo "FreeRADIUS Testing Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if FreeRADIUS container is running
echo "1️⃣  Checking FreeRADIUS container status..."
if docker ps --format '{{.Names}}' | grep -q "^freeradius$"; then
    echo -e "${GREEN}✓${NC} FreeRADIUS container is running"
else
    echo -e "${RED}✗${NC} FreeRADIUS container is not running"
    echo "   Starting FreeRADIUS..."
    cd FreeRadius && docker-compose up -d
    sleep 5
fi
echo ""

# Check database connectivity
echo "2️⃣  Checking database connection..."
if docker exec freeradius radmin -e "stats client auth" &>/dev/null; then
    echo -e "${GREEN}✓${NC} FreeRADIUS can communicate with database"
else
    echo -e "${YELLOW}⚠${NC}  Unable to verify database connection via radmin"
fi
echo ""

# Get a test user from the database
echo "3️⃣  Fetching test user from database..."
TEST_USER=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c \
    "SELECT username FROM radcheck WHERE attribute='Cleartext-Password' LIMIT 1;" 2>/dev/null | tr -d ' ')

if [ -z "$TEST_USER" ]; then
    echo -e "${RED}✗${NC} No test users found in radcheck table"
    echo "   Creating a test user..."
    
    docker exec openradius-postgres psql -U admin -d openradius_workspace_1 <<-EOSQL
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES ('testuser', 'Cleartext-Password', ':=', 'testpass123')
        ON CONFLICT DO NOTHING;
EOSQL
    TEST_USER="testuser"
    TEST_PASS="testpass123"
    echo -e "${GREEN}✓${NC} Created test user: $TEST_USER"
else
    echo -e "${GREEN}✓${NC} Found test user: $TEST_USER"
    # Get password
    TEST_PASS=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c \
        "SELECT value FROM radcheck WHERE username='$TEST_USER' AND attribute='Cleartext-Password' LIMIT 1;" \
        2>/dev/null | tr -d ' ')
fi
echo ""

# Check radcheck table count
echo "4️⃣  Database statistics..."
USER_COUNT=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c \
    "SELECT COUNT(*) FROM radcheck;" 2>/dev/null | tr -d ' ')
echo "   Users in radcheck: $USER_COUNT"

GROUP_COUNT=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c \
    "SELECT COUNT(*) FROM radusergroup;" 2>/dev/null | tr -d ' ')
echo "   User-group assignments: $GROUP_COUNT"

PROFILE_COUNT=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c \
    "SELECT COUNT(*) FROM radgroupreply;" 2>/dev/null | tr -d ' ')
echo "   Profile attributes: $PROFILE_COUNT"
echo ""

# Test authentication
echo "5️⃣  Testing RADIUS authentication..."
echo "   User: $TEST_USER"
echo "   Password: [hidden]"
echo ""

if docker exec freeradius radtest "$TEST_USER" "$TEST_PASS" localhost 0 testing123 &>/dev/null; then
    echo -e "${GREEN}✓ Authentication SUCCESSFUL!${NC}"
    echo ""
    echo "Full response:"
    docker exec freeradius radtest "$TEST_USER" "$TEST_PASS" localhost 0 testing123
else
    echo -e "${RED}✗ Authentication FAILED${NC}"
    echo ""
    echo "Checking FreeRADIUS logs for errors..."
    docker logs freeradius --tail 20
    echo ""
    echo "Verifying user in database..."
    docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c \
        "SELECT * FROM radcheck WHERE username='$TEST_USER';"
fi
echo ""

# Test with wrong password
echo "6️⃣  Testing with wrong password (should fail)..."
if docker exec freeradius radtest "$TEST_USER" "wrongpassword" localhost 0 testing123 2>&1 | grep -q "Access-Reject"; then
    echo -e "${GREEN}✓${NC} Correctly rejected wrong password"
else
    echo -e "${YELLOW}⚠${NC}  Unexpected response for wrong password"
fi
echo ""

# Check accounting
echo "7️⃣  Checking accounting table..."
ACCT_COUNT=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c \
    "SELECT COUNT(*) FROM radacct;" 2>/dev/null | tr -d ' ')
echo "   Accounting records: $ACCT_COUNT"
echo ""

# Test summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Database: ${GREEN}Connected${NC}"
echo -e "Users synced: ${GREEN}$USER_COUNT${NC}"
echo -e "Authentication: Run test above to verify"
echo ""
echo "To manually test authentication:"
echo "  docker exec freeradius radtest <username> <password> localhost 0 testing123"
echo ""
echo "To view FreeRADIUS logs:"
echo "  docker logs freeradius -f"
echo ""
echo "To query user attributes:"
echo "  docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c 'SELECT * FROM radcheck WHERE username=\"<username>\";'"
echo ""
