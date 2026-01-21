#!/bin/bash

# Script to enable Token Exchange for impersonation in Keycloak
# This allows the admin client to exchange tokens to impersonate users

KEYCLOAK_URL="http://localhost:8080"
REALM="openradius"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin123"
ADMIN_CLIENT_ID="openradius-admin"
TARGET_CLIENT_ID="openradius-web"

echo "🔑 Authenticating with Keycloak..."

# Get admin token
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD")

ADMIN_TOKEN=$(echo $TOKEN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to authenticate"
    exit 1
fi

echo "✅ Authenticated successfully"
echo ""

# Get openradius-admin client UUID
echo "🔍 Finding admin client..."
ADMIN_CLIENT_DATA=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$ADMIN_CLIENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CLIENT_UUID=$(echo $ADMIN_CLIENT_DATA | python3 -c "import sys, json; data = json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)

if [ -z "$ADMIN_CLIENT_UUID" ]; then
    echo "❌ Admin client not found"
    exit 1
fi

echo "✅ Admin client UUID: $ADMIN_CLIENT_UUID"
echo ""

# Get target client UUID
echo "🔍 Finding target client..."
TARGET_CLIENT_DATA=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$TARGET_CLIENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

TARGET_CLIENT_UUID=$(echo $TARGET_CLIENT_DATA | python3 -c "import sys, json; data = json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)

if [ -z "$TARGET_CLIENT_UUID" ]; then
    echo "❌ Target client not found"
    exit 1
fi

echo "✅ Target client UUID: $TARGET_CLIENT_UUID"
echo ""

# Create token exchange permission for admin client
echo "🔐 Enabling token exchange permission..."

# Update admin client to allow token exchange
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/clients/$ADMIN_CLIENT_UUID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$ADMIN_CLIENT_ID'",
    "authorizationServicesEnabled": false,
    "serviceAccountsEnabled": true,
    "attributes": {
      "token.exchange.grant.enabled": "true"
    }
  }' > /dev/null

echo "✅ Token exchange enabled for admin client"
echo ""

# Create scope for token exchange
echo "🎯 Creating token exchange scope..."

# Get service account user ID
SERVICE_ACCOUNT=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$ADMIN_CLIENT_UUID/service-account-user" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

SERVICE_ACCOUNT_ID=$(echo $SERVICE_ACCOUNT | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

echo "Service account ID: $SERVICE_ACCOUNT_ID"
echo ""

# Grant token-exchange permission
echo "🔓 Granting token-exchange permission to service account..."

# Get realm-management client
REALM_MGMT=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=realm-management" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

REALM_MGMT_UUID=$(echo $REALM_MGMT | python3 -c "import sys, json; data = json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)

# Get token-exchange role
TOKEN_EXCHANGE_ROLE=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients/$REALM_MGMT_UUID/roles/token-exchange" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ROLE_ID=$(echo $TOKEN_EXCHANGE_ROLE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ ! -z "$ROLE_ID" ]; then
    # Assign token-exchange role to service account
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$SERVICE_ACCOUNT_ID/role-mappings/clients/$REALM_MGMT_UUID" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '[{"id":"'$ROLE_ID'","name":"token-exchange"}]' > /dev/null
    
    echo "✅ token-exchange role assigned"
else
    echo "⚠️  token-exchange role not found (may not be needed in newer Keycloak versions)"
fi

echo ""
echo "✨ Token exchange configuration complete! ✨"
echo ""
echo "The admin client can now exchange tokens to impersonate users."
echo "Restart the backend and try impersonating a user again."
