# OIDC Authentication with Keycloak

## Overview

OpenRadius uses **OpenID Connect (OIDC)** with **Keycloak** as the identity provider for enterprise-grade authentication and authorization. We implement the **OIDC Authorization Code Flow** for secure, standards-based authentication.

## What is OIDC?

OpenID Connect (OIDC) is an identity layer built on top of OAuth 2.0. It allows clients to verify the identity of end-users based on authentication performed by an authorization server, as well as to obtain basic profile information about the user.

### Key Benefits

- **Industry Standard**: OIDC is a widely adopted industry standard for authentication
- **Secure**: Uses proven cryptographic methods and security best practices
- **Interoperable**: Works with any OIDC-compliant identity provider
- **Single Sign-On (SSO)**: Users can authenticate once and access multiple applications
- **Token-Based**: Uses JWT tokens for secure, stateless authentication

## Architecture

### Components

1. **Keycloak (OIDC Provider)**
   - Central identity and access management system
   - Handles user authentication
   - Issues access tokens and ID tokens
   - Manages user sessions

2. **Backend API (.NET)**
   - Validates OIDC tokens
   - Protects API endpoints
   - Manages OIDC provider configuration

3. **Frontend (React)**
   - Initiates authentication flow
   - Manages user sessions
   - Stores and refreshes tokens

### OIDC Authorization Code Flow

```
┌─────────┐                                  ┌──────────┐                               ┌──────────┐
│ Browser │                                  │ Frontend │                               │ Keycloak │
└────┬────┘                                  └─────┬────┘                               └─────┬────┘
     │                                             │                                          │
     │ 1. Click Login                              │                                          │
     ├────────────────────────────────────────────►│                                          │
     │                                             │                                          │
     │                                             │ 2. Redirect to Keycloak with PKCE       │
     │                                             ├─────────────────────────────────────────►│
     │                                             │                                          │
     │                                             │                                          │ 3. User logs in
     │                                             │                                          │
     │                                             │ 4. Redirect with authorization code     │
     │                                             │◄─────────────────────────────────────────┤
     │                                             │                                          │
     │                                             │ 5. Exchange code for tokens             │
     │                                             ├─────────────────────────────────────────►│
     │                                             │                                          │
     │                                             │ 6. Return access token & ID token       │
     │                                             │◄─────────────────────────────────────────┤
     │                                             │                                          │
     │ 7. User authenticated                       │                                          │
     │◄────────────────────────────────────────────┤                                          │
     │                                             │                                          │
```

### Security Features

1. **PKCE (Proof Key for Code Exchange)**
   - Prevents authorization code interception attacks
   - Automatically implemented in our setup

2. **Token Validation**
   - Signature verification using Keycloak's public keys
   - Issuer validation
   - Expiration time validation
   - Optional audience validation

3. **Automatic Token Refresh**
   - Tokens are automatically refreshed before expiration
   - Maintains user session without interruption
   - Forces re-authentication if refresh fails

## Configuration

### Backend Configuration

The backend OIDC configuration is stored in `appsettings.json`:

```json
{
  "Oidc": {
    "Authority": "http://localhost:8080/realms/openradius",
    "ClientId": "openradius-api",
    "ClientSecret": "",
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

#### Configuration Properties

- **Authority**: The base URL of your OIDC provider (Keycloak realm)
- **ClientId**: The client ID registered in Keycloak
- **ClientSecret**: Optional secret for confidential clients
- **RedirectUri**: Where to redirect after successful authentication
- **PostLogoutRedirectUri**: Where to redirect after logout
- **ResponseType**: Use "code" for Authorization Code Flow
- **Scope**: OIDC scopes (openid is required)
- **MetadataAddress**: OIDC discovery endpoint
- **RequireHttpsMetadata**: Set to true in production
- **Issuer**: Expected issuer value in tokens
- **Audience**: Expected audience value in tokens
- **ValidateAudience**: Whether to validate audience claim

### Frontend Configuration

Frontend configuration is in `.env`:

```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
VITE_API_URL=http://localhost:5000
```

## Keycloak Setup

### 1. Create Realm

1. Access Keycloak admin console at `http://localhost:8080`
2. Login with admin credentials (admin/admin)
3. Create a new realm named `openradius`

### 2. Create Backend Client (API)

1. Navigate to Clients → Create Client
2. Client ID: `openradius-api`
3. Client type: OpenID Connect
4. Enable "Client authentication" for confidential client
5. Valid redirect URIs: `http://localhost:5000/*`
6. Configure scopes: `openid`, `profile`, `email`

### 3. Create Frontend Client (Web)

1. Navigate to Clients → Create Client
2. Client ID: `openradius-web`
3. Client type: OpenID Connect
4. Client authentication: OFF (public client)
5. Valid redirect URIs: `http://localhost:5173/*`
6. Web origins: `http://localhost:5173`
7. Configure scopes: `openid`, `profile`, `email`
8. Enable "Standard Flow" (Authorization Code Flow)
9. Enable "Direct Access Grants"

### 4. Create Users

1. Navigate to Users → Add User
2. Fill in user details
3. Set credentials in the Credentials tab

## Admin Panel

The OIDC provider can be configured from the admin panel at `/settings/oidc`.

### Features

- **View Current Configuration**: See active OIDC provider settings
- **Update Settings**: Modify OIDC provider configuration
- **Test Connection**: Verify connectivity to OIDC provider
- **Multiple Configurations**: Store multiple OIDC configurations
- **Activate Configuration**: Set which configuration is active

### API Endpoints

#### Get Active Configuration
```http
GET /api/oidcsettings/active
Authorization: Bearer {token}
```

#### Get All Configurations
```http
GET /api/oidcsettings
Authorization: Bearer {token}
```

#### Create Configuration
```http
POST /api/oidcsettings
Content-Type: application/json
Authorization: Bearer {token}

{
  "authority": "http://localhost:8080/realms/openradius",
  "clientId": "openradius-web",
  "redirectUri": "http://localhost:5173",
  "scope": "openid profile email",
  "responseType": "code",
  "isActive": true
}
```

#### Update Configuration
```http
PUT /api/oidcsettings/{id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "authority": "http://localhost:8080/realms/openradius",
  "clientId": "openradius-web",
  ...
}
```

#### Test Connection
```http
POST /api/oidcsettings/test
Content-Type: application/json
Authorization: Bearer {token}

{
  "authority": "http://localhost:8080/realms/openradius",
  "metadataAddress": "http://localhost:8080/realms/openradius/.well-known/openid-configuration"
}
```

## Development

### Running the Application

1. **Start Keycloak**
   ```bash
   docker-compose up keycloak
   ```

2. **Run Backend**
   ```bash
   cd Backend
   dotnet run
   ```

3. **Run Frontend**
   ```bash
   cd Frontend
   npm run dev
   ```

### Token Management

The frontend automatically:
- Stores tokens in memory (not localStorage for security)
- Refreshes tokens before expiration
- Handles token refresh failures by logging out

### Protected Routes

Backend controllers use the `[Authorize]` attribute:

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize] // Requires valid OIDC token
public class MyController : ControllerBase
{
    // Protected endpoints
}
```

Frontend routes use the `ProtectedRoute` component:

```tsx
<ProtectedRoute>
  <MyComponent />
</ProtectedRoute>
```

## Production Deployment

### Security Checklist

- [ ] Enable HTTPS for all endpoints
- [ ] Set `RequireHttpsMetadata: true`
- [ ] Use secure client secrets
- [ ] Configure proper CORS policies
- [ ] Enable audience validation
- [ ] Use environment variables for secrets
- [ ] Configure proper token expiration times
- [ ] Implement rate limiting
- [ ] Enable logging and monitoring
- [ ] Use secure cookie settings

### Environment Variables

Production environments should use environment variables:

**Backend (.NET)**
```bash
Oidc__Authority=https://keycloak.yourdomain.com/realms/openradius
Oidc__ClientId=openradius-api
Oidc__ClientSecret=your-secure-secret
Oidc__RequireHttpsMetadata=true
```

**Frontend (React)**
```bash
VITE_KEYCLOAK_URL=https://keycloak.yourdomain.com
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
VITE_API_URL=https://api.yourdomain.com
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure Keycloak client has correct Web Origins configured
   - Check backend CORS policy allows frontend origin

2. **Token Validation Fails**
   - Verify Authority URL matches issuer in token
   - Check metadata endpoint is accessible
   - Ensure token hasn't expired

3. **Redirect Loop**
   - Check redirect URIs are correctly configured in Keycloak
   - Verify frontend configuration matches Keycloak client

4. **401 Unauthorized**
   - Token may be expired
   - Token refresh may have failed
   - Backend may not be configured correctly

### Debug Mode

Enable detailed logging in backend:

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.AspNetCore.Authentication": "Debug"
    }
  }
}
```

## References

- [OpenID Connect Specification](https://openid.net/connect/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [JWT (JSON Web Tokens)](https://jwt.io/)

## Support

For issues or questions:
1. Check this documentation
2. Review Keycloak logs
3. Check backend API logs
4. Review browser console for frontend errors
5. Verify all configuration matches between components
