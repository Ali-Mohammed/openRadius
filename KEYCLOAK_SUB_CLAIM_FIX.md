# Keycloak 'sub' Claim Configuration

If you encounter the error: **"Missing required 'sub' claim in token"**, follow these steps to configure Keycloak properly.

## Error Symptoms

```
❌ CRITICAL: 'sub' claim is missing from JWT token. Keycloak configuration is incorrect!
System.UnauthorizedAccessException: Missing required 'sub' claim in token. Please check Keycloak configuration.
```

## Fix Steps via Keycloak Admin UI

### Step 1: Access Keycloak Admin Console

1. Navigate to: **https://auth.open-radius.org/admin** (or your Keycloak URL)
2. Login with:
   - Username: `admin`
   - Password: (check your credentials file at `/opt/openradius/openradius-credentials-*.txt`)

### Step 2: Configure openradius-web Client

1. In the left menu, click **Clients**
2. Click on **openradius-web** (the frontend client)
3. Go to **Client scopes** tab at the top

### Step 3: Check Default Client Scopes

Look in the **Assigned default client scopes** section.

#### If "openid" is Already Listed:

1. Click on **openid** in the list
2. Go to **Mappers** tab
3. Check if there's a mapper named **"sub"**

#### If NO "sub" mapper exists:

1. Click **Add mapper** button
2. Select **By configuration**
3. Choose **User Property**
4. Fill in the following fields:
   - **Name**: `sub`
   - **Property**: `id`
   - **Token Claim Name**: `sub`
   - **Claim JSON Type**: `String`
5. Check these boxes:
   - ✅ **Add to ID token**
   - ✅ **Add to access token**
   - ✅ **Add to userinfo**
6. Click **Save**

#### If "openid" is NOT Listed:

1. Click **Add client scope** button
2. Find and select **openid** from the list
3. Choose **Default** (not Optional)
4. Click **Add**
5. Then follow the steps above to add the "sub" mapper

### Step 4: Apply Changes

After making these changes:

1. **Logout** from your application (https://open-radius.org)
2. **Clear browser cache/cookies** (or use an incognito/private window)
3. **Login again**

The JWT token should now contain the 'sub' claim with the user's Keycloak ID.

## Verify the Fix

After logging in, check the backend logs:

```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep "sub"
```

You should see the 'sub' claim in the token claims instead of error messages.

## Alternative: Command Line Fix

If you prefer using the command line, run this on your server:

```bash
# Authenticate with Keycloak
docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin \
  --password YOUR_KEYCLOAK_ADMIN_PASSWORD

# Get the openid scope ID
OPENID_SCOPE_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get client-scopes \
  -r openradius --fields id,name 2>/dev/null | grep -B1 '"name" : "openid"' | grep '"id"' | cut -d'"' -f4)

# Add the 'sub' protocol mapper
docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create \
  client-scopes/$OPENID_SCOPE_ID/protocol-mappers/models \
  -r openradius \
  -s name=sub \
  -s protocol=openid-connect \
  -s protocolMapper=oidc-usermodel-property-mapper \
  -s 'config."user.attribute"=id' \
  -s 'config."id.token.claim"=true' \
  -s 'config."access.token.claim"=true' \
  -s 'config."userinfo.token.claim"=true' \
  -s 'config."claim.name"=sub' \
  -s 'config."jsonType.label"=String'

# Get openradius-web client ID
WEB_CLIENT_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get clients \
  -r openradius --fields id,clientId 2>/dev/null | grep -B1 '"clientId" : "openradius-web"' | grep '"id"' | cut -d'"' -f4)

# Assign openid scope to the client
docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh update \
  clients/$WEB_CLIENT_ID/default-client-scopes/$OPENID_SCOPE_ID \
  -r openradius
```

Then logout and login again.

## Why is the 'sub' Claim Required?

The 'sub' (subject) claim is a standard OpenID Connect claim that uniquely identifies the user. OpenRadius uses this claim to:

- Link Keycloak users to the internal database
- Track user sessions and workspaces
- Enable user impersonation features
- Maintain audit trails

Without the 'sub' claim, the application cannot identify users properly and will reject authentication attempts.
