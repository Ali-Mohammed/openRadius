#!/bin/bash
# Quick FreeRADIUS test - checks if a user can authenticate

echo "Fetching a test user..."
USER=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c "SELECT username FROM radcheck LIMIT 1;" 2>/dev/null | xargs)
PASS=$(docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -t -c "SELECT value FROM radcheck WHERE username='$USER' AND attribute='Cleartext-Password' LIMIT 1;" 2>/dev/null | xargs)

echo "Testing authentication for user: $USER"
echo ""
docker exec freeradius radtest "$USER" "$PASS" localhost 0 testing123
