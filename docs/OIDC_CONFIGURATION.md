# OIDC Multi-Provider Configuration Guide

## Overview
OpenRadius now supports multiple OIDC authentication providers that can be configured entirely from the frontend admin panel. This allows you to offer users different login options like Keycloak, Azure AD, Google, or any custom OIDC provider.

## Features
- ✅ **Multiple Providers**: Configure Keycloak, Azure AD, Google, and custom OIDC providers
- ✅ **Admin Panel Management**: Add, edit, delete, and test providers from the UI
- ✅ **Provider Templates**: Quick setup with pre-configured templates
- ✅ **Dynamic Selection**: Users choose their provider on the login page
- ✅ **Default Provider**: Set a default provider for users
- ✅ **Active/Inactive Toggle**: Control which providers are visible on the login page

## Configuration from Frontend

### Accessing the Admin Panel
1. Navigate to **Settings → OIDC Providers** in the app
2. You must be authenticated as an admin to access this page

### Adding a New Provider

#### Using Templates (Recommended)
1. Click **"Add Provider"**
2. Select a template:
   - **Keycloak**: Enterprise IAM solution
   - **Azure AD**: Microsoft Azure Active Directory
   - **Google**: Sign in with Google
   - **Custom Provider**: Configure from scratch

3. Fill in the required fields:
   - **Provider Name**: Unique identifier (e.g., `keycloak`, `azuread`, `google`)
   - **Display Name**: Name shown on login page (e.g., "Login with Keycloak")
   - **Description**: Optional description for users
   - **Authority URL**: OIDC provider URL (e.g., `http://localhost:8080/realms/openradius`)
   - **Client ID**: Your application's client ID from the provider
   - **Client Secret**: Optional, for confidential clients
   - **Redirect URI**: Defaults to `http://localhost:5173`
   - **Scope**: OIDC scopes (default: `openid profile email`)

4. Configure optional settings:
   - **Display Order**: Controls ordering on login page
   - **Active**: Show/hide on login page
   - **Default**: Set as the default provider

5. Click **"Test Connection"** to verify configuration
6. Click **"Create Provider"** to save

### Example Configurations

#### Keycloak
```json
{
  "providerName": "keycloak",
  "displayName": "Login with Keycloak",
  "description": "Enterprise Identity and Access Management",
  "authority": "http://localhost:8080/realms/openradius",
  "clientId": "openradius-web",
  "redirectUri": "http://localhost:5173",
  "scope": "openid profile email",
  "requireHttpsMetadata": false
}
```

#### Azure AD
```json
{
  "providerName": "azuread",
  "displayName": "Login with Microsoft",
  "description": "Microsoft Azure Active Directory",
  "authority": "https://login.microsoftonline.com/{tenant-id}/v2.0",
  "clientId": "your-azure-app-client-id",
  "redirectUri": "http://localhost:5173",
  "scope": "openid profile email",
  "requireHttpsMetadata": true,
  "validateAudience": true
}
```

#### Google
```json
{
  "providerName": "google",
  "displayName": "Sign in with Google",
  "description": "Use your Google account",
  "authority": "https://accounts.google.com",
  "clientId": "your-google-client-id.apps.googleusercontent.com",
  "redirectUri": "http://localhost:5173",
  "scope": "openid profile email",
  "requireHttpsMetadata": true,
  "validateAudience": true
}
```

### Managing Providers

#### Edit a Provider
1. Click the **Edit** button (pencil icon) on any provider
2. Update the configuration
3. Click **"Test Connection"** to verify changes
4. Click **"Update Provider"** to save

#### Delete a Provider
1. Click the **Delete** button (trash icon) on any provider
2. Confirm the deletion
3. The provider will be removed from the database

#### Toggle Active Status
- Click the **Active/Inactive** badge to toggle visibility on the login page
- Inactive providers are hidden from users but remain configured

#### Set Default Provider
- Click the **Star** icon to set a provider as default
- Only one provider can be default at a time
- Default providers appear first on the login page

#### Test Connection
- Use the **"Test Connection"** button to verify provider configuration
- This checks if the OIDC metadata endpoint is accessible
- Helps diagnose configuration issues before going live

## User Login Flow

1. User navigates to the app
2. Login page displays all **Active** providers
3. User selects their preferred provider (e.g., "Login with Keycloak")
4. App redirects to the selected provider's login page
5. User authenticates with their credentials
6. Provider redirects back to the app with authentication token
7. App validates the token and grants access

## Technical Details

### Database Schema
All provider configurations are stored in the `OidcSettings` table with these fields:
- `Id`, `ProviderName`, `DisplayName`, `Description`, `LogoUrl`
- `Authority`, `ClientId`, `ClientSecret`, `RedirectUri`
- `Scope`, `ResponseType`, `MetadataAddress`
- `RequireHttpsMetadata`, `Issuer`, `Audience`, `ValidateAudience`
- `IsActive`, `IsDefault`, `DisplayOrder`
- `CreatedAt`, `UpdatedAt`

### API Endpoints
- `GET /api/oidcsettings/providers` - Get active providers for login page (public)
- `GET /api/oidcsettings/provider/{name}` - Get provider by name (public)
- `GET /api/oidcsettings` - Get all providers (admin)
- `POST /api/oidcsettings` - Create provider (admin)
- `PUT /api/oidcsettings/{id}` - Update provider (admin)
- `DELETE /api/oidcsettings/{id}` - Delete provider (admin)
- `PUT /api/oidcsettings/{id}/set-default` - Set as default (admin)
- `PUT /api/oidcsettings/{id}/toggle-active` - Toggle active status (admin)
- `POST /api/oidcsettings/test` - Test connection (admin)

### Security
- Admin endpoints require JWT authentication
- Client secrets are optional (for public clients using PKCE)
- All providers support OIDC Authorization Code Flow with PKCE (S256)
- Tokens are validated on the backend for issuer, signature, and expiration

## Best Practices

1. **Use HTTPS in Production**: Set `requireHttpsMetadata: true` for production
2. **Test Before Activating**: Always test connection before making a provider active
3. **Descriptive Names**: Use clear display names and descriptions for users
4. **Logical Ordering**: Set display order to prioritize commonly used providers
5. **Keep Secrets Safe**: Client secrets are stored encrypted in the database
6. **Monitor Providers**: Regularly test provider connectivity
7. **Backup Configuration**: Export provider settings before major changes

## Troubleshooting

### "Failed to connect to OIDC provider"
- Verify the Authority URL is correct and accessible
- Check if the provider's metadata endpoint is available
- Ensure CORS is properly configured on the provider

### "Invalid client_id"
- Verify the Client ID matches the one configured on the provider
- Check if the client exists and is enabled on the provider

### "Redirect URI mismatch"
- Ensure the Redirect URI in the app matches the one configured on the provider
- Update the provider configuration to allow your redirect URI

### "Token validation failed"
- Check if the Issuer URL matches the provider's metadata
- Verify the client is configured correctly on the provider
- Ensure the backend can reach the provider's metadata endpoint

## Next Steps

1. Configure your first provider from the admin panel
2. Test the connection to verify it works
3. Make the provider active
4. Test the login flow from the login page
5. Add additional providers as needed
6. Set your preferred default provider

For more information about OIDC configuration on specific providers, refer to their official documentation:
- [Keycloak Documentation](https://www.keycloak.org/docs/latest/)
- [Azure AD Documentation](https://docs.microsoft.com/en-us/azure/active-directory/)
- [Google Identity Platform](https://developers.google.com/identity)
