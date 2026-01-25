# Integration Webhooks

This feature allows external systems to send data to OpenRadius via secure webhook callbacks to update RADIUS user information in real-time.

## Features

- ✅ **Auto-generated webhook URLs** with secure tokens and workspace ID
- ✅ **Enable/disable callback** functionality per integration
- ✅ **Token regeneration** for security rotation
- ✅ **Webhook request logging** with success/failure tracking
- ✅ **IP whitelist** support (optional)
- ✅ **RADIUS user updates** via webhook callbacks
- ✅ **Create users if not exists** option

## Usage

### 1. Access Integrations Page

Navigate to **http://localhost:5173/integrations**

### 2. Create New Integration

1. Click **"Add Integration"** button
2. Fill in the form:
   - **Integration Name**: e.g., "External CRM System"
   - **Integration Type**: Select type (SAS RADIUS, Custom, API)
   - **Enable Callback**: Toggle ON to allow webhook requests
   - **Require Authentication**: Toggle ON to validate tokens (recommended)
   - **Description**: Brief description of the integration

3. Click **"Create Integration"**

### 3. Configure Integration

Each integration card displays:

#### Enable Callback Toggle
- First setting item to enable/disable webhook functionality
- When enabled, the webhook URL becomes active

#### Auto-Generated Webhook URL
Format: `http://localhost:5000/api/webhooks/{workspaceId}/{token}`

Example: `http://localhost:5000/api/webhooks/1/a8f3k9d2m5p7q1w6e4r8t2y5u`

**Copy Button**: Click to copy URL to clipboard

#### Security Token
- Unique secure token automatically generated
- **Show/Hide**: Toggle visibility
- **Copy**: Copy token to clipboard  
- **Regenerate**: Create new token (invalidates old URL)

#### Stats
- **Requests**: Total webhook requests received
- **Last Used**: Timestamp of last successful webhook call

### 4. Settings Menu

Click the **Settings** icon (⚙️) on each integration card to:
- Update integration name
- Change description
- Enable/disable the integration
- Toggle callback functionality

### 5. Delete Integration

Click the **Trash** icon (🗑️) to soft-delete an integration.

## Webhook API

### Endpoint

```
POST http://localhost:5000/api/webhooks/{workspaceId}/{token}
```

### Request Body

```json
{
  "username": "john.doe",
  "externalId": "12345",
  "password": "newpassword",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phoneNumber": "+1234567890",
  "address": "123 Main St",
  "profileId": 5,
  "groupId": 3,
  "isEnabled": true,
  "createIfNotExists": false
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | ✅ Yes | RADIUS username |
| `externalId` | string | ❌ No | External system user ID |
| `password` | string | ❌ No | New password for user |
| `firstName` | string | ❌ No | User's first name |
| `lastName` | string | ❌ No | User's last name |
| `email` | string | ❌ No | User's email address |
| `phoneNumber` | string | ❌ No | User's phone number |
| `address` | string | ❌ No | User's address |
| `profileId` | number | ❌ No | RADIUS profile ID |
| `groupId` | number | ❌ No | RADIUS group ID |
| `isEnabled` | boolean | ❌ No | Enable/disable user |
| `createIfNotExists` | boolean | ❌ No | Create user if not found (default: false) |

### Success Response

```json
{
  "success": true,
  "message": "RADIUS user 'john.doe' updated successfully",
  "data": {
    "radiusUserId": 123,
    "username": "john.doe"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "RADIUS user 'john.doe' not found"
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - User updated |
| 400 | Bad Request - Invalid JSON or missing required fields |
| 403 | Forbidden - Callback disabled or IP not allowed |
| 404 | Not Found - Webhook/token not found |
| 500 | Internal Server Error |

## Example: cURL Request

```bash
curl -X POST "http://localhost:5000/api/webhooks/1/a8f3k9d2m5p7q1w6e4r8t2y5u" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.doe",
    "externalId": "12345",
    "email": "john.doe@example.com",
    "isEnabled": true
  }'
```

## Example: Python Request

```python
import requests

webhook_url = "http://localhost:5000/api/webhooks/1/a8f3k9d2m5p7q1w6e4r8t2y5u"

payload = {
    "username": "john.doe",
    "externalId": "12345",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEnabled": True
}

response = requests.post(webhook_url, json=payload)
print(response.json())
```

## Security Features

### Token Authentication
Every webhook URL contains a unique, randomly generated 32-byte token. The token must match for requests to be processed.

### IP Whitelisting (Optional)
Configure allowed IP addresses in integration settings. Only requests from whitelisted IPs will be processed.

### Token Regeneration
Regenerate tokens to:
- Rotate credentials periodically
- Revoke access after suspected compromise
- Update external system integrations

**⚠️ Warning**: Regenerating a token invalidates the old webhook URL. Update external systems with the new URL.

## Webhook Logging

All webhook requests are logged with:
- Request method and IP address
- Request headers and body
- Response status code
- Processing time (ms)
- Success/failure status
- Error messages (if any)

**View Logs**: Access logs via the API endpoint (coming soon in UI)

## Database Models

### IntegrationWebhook
- `Id`: Primary key
- `WorkspaceId`: Tenant workspace ID
- `IntegrationName`: Display name
- `IntegrationType`: Type (sas-radius, custom, api)
- `CallbackEnabled`: Enable/disable webhook
- `WebhookToken`: Secure random token
- `WebhookUrl`: Auto-generated URL
- `RequireAuthentication`: Token validation flag
- `AllowedIpAddresses`: JSON array of allowed IPs
- `IsActive`: Active status
- `RequestCount`: Total requests received
- `LastUsedAt`: Last successful request timestamp

### WebhookLog
- `Id`: Primary key
- `WebhookId`: Foreign key to IntegrationWebhook
- `Method`: HTTP method (POST)
- `IpAddress`: Client IP
- `Headers`: JSON of request headers
- `RequestBody`: Payload
- `StatusCode`: Response code
- `Success`: Success/failure flag
- `ProcessingTimeMs`: Processing duration

## API Endpoints

### Management Endpoints (Authenticated)

#### Get All Webhooks
```
GET /api/workspaces/{workspaceId}/IntegrationWebhooks
```

#### Get Webhook By ID
```
GET /api/workspaces/{workspaceId}/IntegrationWebhooks/{id}
```

#### Create Webhook
```
POST /api/workspaces/{workspaceId}/IntegrationWebhooks
```

#### Update Webhook
```
PUT /api/workspaces/{workspaceId}/IntegrationWebhooks/{id}
```

#### Delete Webhook
```
DELETE /api/workspaces/{workspaceId}/IntegrationWebhooks/{id}
```

#### Regenerate Token
```
POST /api/workspaces/{workspaceId}/IntegrationWebhooks/{id}/regenerate-token
```

#### Get Webhook Logs
```
GET /api/workspaces/{workspaceId}/IntegrationWebhooks/{id}/logs?page=1&pageSize=50
```

### Public Webhook Endpoint (No Auth Required)

```
POST /api/webhooks/{workspaceId}/{token}
```

## Migration

Database migration: `20260125181037_AddIntegrationWebhooks`

Tables created:
- `IntegrationWebhooks`
- `WebhookLogs`

Apply migration:
```bash
cd Backend
dotnet ef database update --context ApplicationDbContext
```

## Configuration

Add to `appsettings.json`:

```json
{
  "AppSettings": {
    "BaseUrl": "http://localhost:5000"
  }
}
```

The base URL is used to generate webhook URLs. Update for production deployment.

## Troubleshooting

### Webhook Returns 404
- Verify the token hasn't been regenerated
- Check that the workspace ID is correct
- Ensure the webhook hasn't been deleted

### Webhook Returns 403
- Check if callback is enabled in integration settings
- Verify IP address is whitelisted (if IP filtering is enabled)
- Confirm the integration is active

### User Not Found
- Set `createIfNotExists: true` to auto-create users
- Verify the username exists in the database
- Check that the user isn't soft-deleted

## Future Enhancements

- [ ] Webhook logs viewer in UI
- [ ] Retry mechanism for failed webhook processing
- [ ] Rate limiting per integration
- [ ] Custom field mapping configurations
- [ ] Webhook testing tool in UI
- [ ] Email notifications for failed webhooks
- [ ] Bulk user update support
- [ ] Webhook payload validation schemas
