#!/bin/bash

# Script to create and configure openradius-admin client in Keycloak
# Run this script to automate the creation of the admin service account client

KEYCLOAK_URL="http://localhost:8080"
REALM="openradius"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin123"
CLIENT_ID="openradius-admin"
CLIENT_SECRET="openradius-admin-secret-2026"

echo "🔑 Authenticating with Keycloak master realm..."

# Get admin token from master realm
TOKEN_URL="$KEYCLOAK_URL/realms/master/protocol/openid-connect/token"
TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD")

ADMIN_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to authenticate. Please check your credentials and ensure Keycloak is running."
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Successfully authenticated"

# Check if client already exists
echo ""
echo "🔍 Checking if client '$CLIENT_ID' already exists..."
CLIENTS_URL="$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$CLIENT_ID"
EXISTING_CLIENTS=$(curl -s -X GET "$CLIENTS_URL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

CLIENT_UUID=$(echo $EXISTING_CLIENTS | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$CLIENT_UUID" ]; then
    echo "⚠️  Client '$CLIENT_ID' already exists with UUID: $CLIENT_UUID"
    echo "ℹ️  Skipping client creation, proceeding to role assignment..."
else
    # Create the client
    echo ""
    echo "🔧 Creating '$CLIENT_ID' client..."
    CREATE_CLIENT_URL="$KEYCLOAK_URL/admin/realms/$REALM/clients"

    CLIENT_CONFIG='{
      "clientId": "'$CLIENT_ID'",
      "name": "OpenRadius Admin Client",
      "description": "Service account for backend admin operations",
      "enabled": true,
      "publicClient": false,
      "protocol": "openid-connect",
      "standardFlowEnabled": false,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": true,
      "authorizationServicesEnabled": false,
      "secret": "'$CLIENT_SECRET'",
      "attributes": {
        "access.token.lifespan": "3600"
      },
      "defaultClientScopes": [
        "web-origins",
        "acr",
        "profile",
        "roles",
        "email"
      ],
      "optionalClientScopes": [
        "address",
        "phone",
        "offline_access",
        "microprofile-jwt"
      ]
    }'

    CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CREATE_CLIENT_URL" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$CLIENT_CONFIG")

    HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" = "201" ]; then
        echo "✅ Successfully created client '$CLIENT_ID'"
        
        # Retrieve the newly created client UUID
        sleep 1
        EXISTING_CLIENTS=$(curl -s -X GET "$CLIENTS_URL" \
          -H "Authorization: Bearer $ADMIN_TOKEN" \
          -H "Content-Type: application/json")
        CLIENT_UUID=$(echo $EXISTING_CLIENTS | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    else
        echo "❌ Failed to create client. HTTP Code: $HTTP_CODE"
        echo "Response: $(echo "$CREATE_RESPONSE" | head -n-1)"
        exit 1
    fi
fi

# Get the service account user
echo ""
echo "👤 Getting service account user..."
SERVICE_ACCOUNT_URL="$KEYCLOAK_URL/admin/realms/$REALM/clients/$CLIENT_UUID/service-account-user"
SERVICE_ACCOUNT_USER=$(curl -s -X GET "$SERVICE_ACCOUNT_URL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

SERVICE_ACCOUNT_USER_ID=$(echo $SERVICE_ACCOUNT_USER | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$SERVICE_ACCOUNT_USER_ID" ]; then
    echo "❌ Could not retrieve service account user"
    exit 1
fi

echo "✅ Service account user ID: $SERVICE_ACCOUNT_USER_ID"

# Assign admin roles to service account
echo ""
echo "🔐 Assigning comprehensive admin roles to service account..."
REALM_MANAGEMENT_URL="$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=realm-management"
REALM_MANAGEMENT_CLIENT=$(curl -s -X GET "$REALM_MANAGEMENT_URL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

REALM_MANAGEMENT_UUID=$(echo $REALM_MANAGEMENT_CLIENT | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$REALM_MANAGEMENT_UUID" ]; then
    echo "❌ Could not find realm-management client"
    exit 1
fi

# Get all available roles
ROLES_URL="$KEYCLOAK_URL/admin/realms/$REALM/clients/$REALM_MANAGEMENT_UUID/roles"
ALL_ROLES=$(curl -s -X GET "$ROLES_URL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

# Extract and assign required roles
REQUIRED_ROLES=("manage-users" "query-users" "view-users" "view-realm" "query-groups" "impersonation")

echo "📋 Available roles check..."

for ROLE_NAME in "${REQUIRED_ROLES[@]}"; do
    ROLE_DATA=$(echo "$ALL_ROLES" | jq -r ".[] | select(.name==\"$ROLE_NAME\")")
    if [ ! -z "$ROLE_DATA" ]; then
        ROLE_ID=$(echo "$ROLE_DATA" | jq -r '.id')
        ROLE_PAYLOAD="[{\"id\":\"$ROLE_ID\",\"name\":\"$ROLE_NAME\"}]"
        
        ASSIGN_ROLES_URL="$KEYCLOAK_URL/admin/realms/$REALM/users/$SERVICE_ACCOUNT_USER_ID/role-mappings/clients/$REALM_MANAGEMENT_UUID"
        
        ASSIGN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ASSIGN_ROLES_URL" \
          -H "Authorization: Bearer $ADMIN_TOKEN" \
          -H "Content-Type: application/json" \
          -d "$ROLE_PAYLOAD")
        
        HTTP_CODE=$(echo "$ASSIGN_RESPONSE" | tail -n1)
        
        if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
            echo "   ✅ $ROLE_NAME"
        else
            RESPONSE_BODY=$(echo "$ASSIGN_RESPONSE" | head -n-1)
            if echo "$RESPONSE_BODY" | grep -q "already exists"; then
                echo "   ℹ️  $ROLE_NAME (already assigned)"
            else
                echo "   ⚠️  $ROLE_NAME (HTTP $HTTP_CODE)"
            fi
        fi
    else
        echo "   ❌ $ROLE_NAME (not found)"
    fi
done

echo ""
echo "✨ Setup Complete! ✨"
echo ""
echo "Client Configuration:"
echo "  Client ID: $CLIENT_ID"
echo "  Client Secret: $CLIENT_SECRET"
echo "  Service Accounts: Enabled"
echo ""
echo "This client is now ready to be used by the backend!"
echo ""
echo "You can now test the sync endpoint again."
