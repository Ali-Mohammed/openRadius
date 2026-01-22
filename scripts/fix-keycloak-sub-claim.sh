#!/bin/bash

# Script to add 'sub' claim mapper to Keycloak via REST API
# This fixes the missing 'sub' claim in JWT tokens

KEYCLOAK_URL="http://localhost:8080"
REALM="openradius"
ADMIN_USER="admin"
ADMIN_PASS="admin"  # Change this to your actual admin password

echo "🔧 Fixing Keycloak 'sub' claim mapper..."

# 1. Get admin access token
echo "📝 Getting admin access token..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Failed to get admin token. Check your credentials."
  exit 1
fi

echo "✅ Got admin token"

# 2. Get the 'openid' client scope ID
echo "📝 Getting 'openid' client scope ID..."
SCOPE_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.name=="openid") | .id')

if [ -z "$SCOPE_ID" ]; then
  echo "❌ Could not find 'openid' client scope"
  exit 1
fi

echo "✅ Found 'openid' scope: $SCOPE_ID"

# 3. Check if 'sub' mapper already exists
echo "📝 Checking for existing 'sub' mapper..."
EXISTING_MAPPER=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes/$SCOPE_ID/protocol-mappers/models" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.name=="sub") | .id')

if [ ! -z "$EXISTING_MAPPER" ]; then
  echo "⚠️  'sub' mapper already exists (ID: $EXISTING_MAPPER)"
  echo "🔄 Deleting existing mapper to recreate..."
  curl -s -X DELETE "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes/$SCOPE_ID/protocol-mappers/models/$EXISTING_MAPPER" \
    -H "Authorization: Bearer $ADMIN_TOKEN"
fi

# 4. Create the 'sub' mapper
echo "📝 Creating 'sub' claim mapper..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes/$SCOPE_ID/protocol-mappers/models" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sub",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-property-mapper",
    "consentRequired": false,
    "config": {
      "userinfo.token.claim": "true",
      "user.attribute": "id",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "claim.name": "sub",
      "jsonType.label": "String"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "201" ]; then
  echo "✅ Successfully created 'sub' mapper!"
  echo ""
  echo "🎉 DONE! The 'sub' claim will now be included in JWT tokens."
  echo ""
  echo "📋 Next steps:"
  echo "   1. Restart your backend: cd Backend && dotnet run"
  echo "   2. Logout from frontend"
  echo "   3. Login again to get new token with 'sub' claim"
  echo "   4. Check logs - you should see: sub=<uuid>"
  echo ""
else
  echo "❌ Failed to create mapper. HTTP Code: $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi
