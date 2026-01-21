#!/bin/bash

# Configure Account Console Client Scopes
# This script adds required client scopes to the account-console client
# Needed for password management and 2FA functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Keycloak connection settings
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin123}"
REALM="${KEYCLOAK_REALM:-openradius}"

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  Configure Account Console${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Function to get admin token
get_admin_token() {
    TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -d "client_id=admin-cli" \
        -d "username=${ADMIN_USER}" \
        -d "password=${ADMIN_PASSWORD}" \
        -d "grant_type=password" | \
        python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    
    if [ -z "$TOKEN" ]; then
        echo -e "${RED}Failed to get admin token. Is Keycloak running?${NC}"
        exit 1
    fi
}

echo -e "${GREEN}[1/4] Getting admin token...${NC}"
get_admin_token
echo -e "  ${GREEN}✓ Token obtained${NC}"

# Get account-console client ID
echo ""
echo -e "${GREEN}[2/4] Finding account-console client...${NC}"
CLIENT_UUID=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys, json; clients = json.load(sys.stdin); account_client = [c for c in clients if c.get('clientId') == 'account-console']; print(account_client[0]['id'] if account_client else '')" 2>/dev/null)

if [ -z "$CLIENT_UUID" ]; then
    echo -e "${RED}Failed to find account-console client${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ Found client: ${CLIENT_UUID}${NC}"

# Get client scope IDs
echo ""
echo -e "${GREEN}[3/4] Getting client scope IDs...${NC}"
SCOPE_IDS=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/client-scopes" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys, json; scopes = json.load(sys.stdin); profile = [s for s in scopes if s.get('name') == 'profile'][0]; email = [s for s in scopes if s.get('name') == 'email'][0]; roles = [s for s in scopes if s.get('name') == 'roles'][0]; print(f\"{profile['id']} {email['id']} {roles['id']}\")" 2>/dev/null)

if [ -z "$SCOPE_IDS" ]; then
    echo -e "${RED}Failed to get client scope IDs${NC}"
    exit 1
fi

read PROFILE_ID EMAIL_ID ROLES_ID <<< "$SCOPE_IDS"

echo -e "  ${GREEN}✓ profile: ${PROFILE_ID}${NC}"
echo -e "  ${GREEN}✓ email: ${EMAIL_ID}${NC}"
echo -e "  ${GREEN}✓ roles: ${ROLES_ID}${NC}"

# Add scopes to account-console client
echo ""
echo -e "${GREEN}[4/4] Adding client scopes to account-console...${NC}"

# Add profile scope
curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/default-client-scopes/${PROFILE_ID}" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
echo -e "  ${GREEN}✓ Added profile scope${NC}"

# Add email scope
curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/default-client-scopes/${EMAIL_ID}" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
echo -e "  ${GREEN}✓ Added email scope${NC}"

# Add roles scope
curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/default-client-scopes/${ROLES_ID}" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
echo -e "  ${GREEN}✓ Added roles scope${NC}"

# Verify scopes were added
echo ""
echo -e "${CYAN}Verifying configuration...${NC}"
ADDED_SCOPES=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/default-client-scopes" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys, json; scopes = json.load(sys.stdin); [print(f'  ✓ {s.get(\"name\")}') for s in scopes]" 2>/dev/null)

echo "$ADDED_SCOPES"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Configuration Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "The account-console client is now properly configured."
echo "Users can now:"
echo "  • Change their passwords"
echo "  • Set up Two-Factor Authentication (2FA)"
echo "  • Manage account settings"
echo ""
