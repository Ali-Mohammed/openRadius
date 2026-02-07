# Keycloak Setup Guide for OpenRadius

This guide walks you through setting up Keycloak as the OIDC provider for OpenRadius.

## Prerequisites

- Docker and Docker Compose running
- OpenRadius services started

## Step 1: Access Keycloak Admin Console

1. Start Keycloak if not already running:
   ```bash
   docker-compose up -d keycloak
   ```

2. Wait for Keycloak to start (about 30 seconds)

3. Access the admin console:
   - URL: http://localhost:8080
   - Username: `admin`
   - Password: `admin`

## Step 2: Create Realm

1. Click on the dropdown in the top-left corner (currently showing "master")
2. Click **"Create Realm"**
3. Enter the following:
   - **Realm name**: `openradius`
   - **Enabled**: ON
4. Click **"Create"**

## Step 3: Create Backend API Client

This client is used by the backend to validate tokens.

1. In the `openradius` realm, navigate to **Clients** in the left sidebar
2. Click **"Create client"**

### Basic Settings
- **Client type**: `OpenID Connect`
- **Client ID**: `openradius-api`
- Click **"Next"**

### Capability config
- **Client authentication**: ON (confidential client)
- **Authorization**: OFF
- **Authentication flow**:
  - ✅ Standard flow
  - ✅ Direct access grants
  - ❌ Implicit flow
  - ❌ Service accounts roles
- Click **"Next"**

### Login settings
- **Root URL**: `http://localhost:5000`
- **Home URL**: `http://localhost:5000`
- **Valid redirect URIs**: 
  - `http://localhost:5000/*`
- **Valid post logout redirect URIs**: 
  - `http://localhost:5000/*`
- **Web origins**: 
  - `http://localhost:5000`
- Click **"Save"**

### Get Client Secret
1. Go to the **"Credentials"** tab
2. Copy the **Client Secret**
3. Update `Backend/appsettings.json`:
   ```json
   {
     "Oidc": {
       "ClientSecret": "paste-the-secret-here"
     }
   }
   ```

## Step 4: Create Frontend Web Client

This client is used by the React frontend for user authentication.

1. Navigate to **Clients** → **"Create client"**

### Basic Settings
- **Client type**: `OpenID Connect`
- **Client ID**: `openradius-web`
- Click **"Next"**

### Capability config
- **Client authentication**: OFF (public client)
- **Authorization**: OFF
- **Authentication flow**:
  - ✅ Standard flow (Authorization Code Flow)
  - ✅ Direct access grants
  - ❌ Implicit flow
  - ❌ Service accounts roles
- Click **"Next"**

### Login settings
- **Root URL**: `http://localhost:5173`
- **Home URL**: `http://localhost:5173`
- **Valid redirect URIs**: 
  - `http://localhost:5173/*`
  - `http://localhost:5173`
- **Valid post logout redirect URIs**: 
  - `http://localhost:5173/*`
  - `http://localhost:5173`
- **Web origins**: 
  - `http://localhost:5173`
  - `+` (adds all valid redirect URIs)
- Click **"Save"**

### Advanced Settings (Optional but Recommended)

1. Go to the **"Advanced"** tab
2. **Proof Key for Code Exchange Code Challenge Method**: `S256` (PKCE)
3. Click **"Save"**

## Step 5: Configure Client Scopes

Both clients should have access to the following scopes:

1. Navigate to **Client scopes**
2. Verify these default scopes exist:
   - `openid` (required)
   - `profile`
   - `email`

For each client (`openradius-api` and `openradius-web`):
1. Go to **Clients** → Select client → **"Client scopes"** tab
2. Ensure the following are in **"Assigned default client scopes"**:
   - `openid`
   - `profile`
   - `email`

## Step 6: Create Test User

1. Navigate to **Users** in the left sidebar
2. Click **"Add user"**
3. Fill in the details:
   - **Username**: `testuser`
   - **Email**: `test@open-radius.org`
   - **First name**: `Test`
   - **Last name**: `User`
   - **Email verified**: ON
   - **Enabled**: ON
4. Click **"Create"**

### Set User Password
1. Go to the **"Credentials"** tab
2. Click **"Set password"**
3. Enter password: `password123` (or your choice)
4. **Temporary**: OFF (so user doesn't need to change password on first login)
5. Click **"Save"**
6. Confirm by clicking **"Save password"**

## Step 7: Create Admin User (Optional)

For accessing the admin panel:

1. Navigate to **Users** → **"Add user"**
2. Fill in the details:
   - **Username**: `admin`
   - **Email**: `admin@open-radius.org`
   - **First name**: `Admin`
   - **Last name**: `User`
   - **Email verified**: ON
   - **Enabled**: ON
3. Click **"Create"**
4. Set password in the **"Credentials"** tab

### Assign Admin Role
1. Go to the user's **"Role mappings"** tab
2. Assign appropriate roles (create custom roles as needed)

## Step 8: Verify Configuration

### Check Realm Settings
1. Navigate to **Realm settings** → **"General"** tab
2. Verify:
   - **Endpoints**: Click "OpenID Endpoint Configuration"
   - Should show: `http://localhost:8080/realms/openradius/.well-known/openid-configuration`

### Test OIDC Discovery
Open this URL in your browser:
```
http://localhost:8080/realms/openradius/.well-known/openid-configuration
```

You should see a JSON response with OIDC endpoints like:
- `authorization_endpoint`
- `token_endpoint`
- `userinfo_endpoint`
- `jwks_uri`

## Step 9: Update Application Configuration

### Backend (Backend/appsettings.json)
Verify the OIDC configuration:
```json
{
  "Oidc": {
    "Authority": "http://localhost:8080/realms/openradius",
    "ClientId": "openradius-api",
    "ClientSecret": "your-client-secret-from-step-3",
    "RedirectUri": "http://localhost:5173",
    "PostLogoutRedirectUri": "http://localhost:5173",
    "ResponseType": "code",
    "Scope": "openid profile email",
    "MetadataAddress": "http://localhost:8080/realms/openradius/.well-known/openid-configuration",
    "RequireHttpsMetadata": false,
    "Issuer": "http://localhost:8080/realms/openradius",
    "Audience": "openradius-api",
    "ValidateAudience": false
  }
}
```

### Frontend (Frontend/.env)
Verify the environment variables:
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
VITE_API_URL=http://localhost:5000
```

## Step 10: Test Authentication

### Start the Application

1. **Backend**:
   ```bash
   cd Backend
   dotnet run
   ```
   Should be running on: http://localhost:5000

2. **Frontend**:
   ```bash
   cd Frontend
   npm run dev
   ```
   Should be running on: http://localhost:5173

### Test Login Flow

1. Open http://localhost:5173
2. You should be redirected to the login page
3. Click "Login" button
4. You'll be redirected to Keycloak login page
5. Login with:
   - **Username**: `testuser`
   - **Password**: `password123`
6. After successful authentication, you'll be redirected back to the application
7. You should see the dashboard

### Verify Token

1. Open browser developer tools (F12)
2. Go to Console
3. You should see: `OIDC Authentication initialized: Authenticated`
4. Check Network tab for API requests
5. Verify Authorization header contains `Bearer eyJ...` token

## Troubleshooting

### Issue: "Invalid redirect URI"
**Solution**: 
- Double-check the redirect URIs in Keycloak client settings
- Ensure they exactly match the frontend URL
- Include both `http://localhost:5173` and `http://localhost:5173/*`

### Issue: CORS errors
**Solution**: 
- Add frontend URL to Web Origins in Keycloak client settings
- Or use `+` to automatically allow all redirect URIs

### Issue: "Client not found"
**Solution**: 
- Verify Client ID in frontend `.env` matches Keycloak client ID exactly
- Check you're using the correct realm

### Issue: Token validation fails in backend
**Solution**: 
- Verify Authority URL in backend matches Keycloak realm URL
- Check that metadata endpoint is accessible
- Ensure client secret is correct (for API client)

### Issue: "Failed to fetch"
**Solution**: 
- Ensure Keycloak is running: `docker-compose ps`
- Check Keycloak logs: `docker-compose logs keycloak`
- Verify network connectivity

## Advanced Configuration

### Enable HTTPS (Production)

1. In Keycloak, go to **Realm settings** → **"Login"** tab
2. **Require SSL**: `all requests`
3. Update application configuration to use HTTPS URLs
4. Set `RequireHttpsMetadata: true` in backend config

### Token Lifetimes

1. Go to **Realm settings** → **"Tokens"** tab
2. Configure:
   - **Access Token Lifespan**: 5 minutes (recommended)
   - **SSO Session Idle**: 30 minutes
   - **SSO Session Max**: 10 hours
   - **Client Session Idle**: 30 minutes
   - **Client Session Max**: 10 hours

### Custom Claims

1. Go to **Client scopes** → Select scope → **"Mappers"** tab
2. Add custom claims to tokens as needed

### Themes

1. Go to **Realm settings** → **"Themes"** tab
2. Customize login page appearance

## Next Steps

- [x] Keycloak configured
- [x] Clients created
- [x] Users created
- [x] Authentication tested
- [ ] Configure user roles and permissions
- [ ] Set up custom claims
- [ ] Configure multi-factor authentication (optional)
- [ ] Set up email server for password reset (optional)
- [ ] Configure session management
- [ ] Test token refresh flow

## Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OIDC Specification](https://openid.net/connect/)
- [OpenRadius OIDC Documentation](./OIDC_AUTHENTICATION.md)
