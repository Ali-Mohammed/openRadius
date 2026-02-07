# Microservice Approval System

## Overview

The microservice approval system provides secure, machine-based authentication for microservices connecting to the OpenRadius backend. Once a microservice is approved on a specific machine, it will automatically connect on subsequent runs without requiring re-approval.

## Architecture

### Machine Identity

Each machine generates a unique identifier based on:
- All non-loopback MAC addresses (sorted for consistency)
- Machine name (`Environment.MachineName`)
- Username (`Environment.UserName`)
- Process architecture (`RuntimeInformation.ProcessArchitecture`)

The combination is hashed using SHA256 to create a stable, unique machine identifier that won't change across reboots.

### Approval Token

When a microservice first connects from a new machine:
1. It generates a machine ID
2. Sends a registration request with the machine ID
3. The backend creates an approval request with a secure token (HMACSHA256)
4. An administrator must approve the connection
5. Once approved, the microservice can connect automatically

The approval token is stored locally in:
- **Linux/macOS**: `~/.config/OpenRadius/.machine_identity`
- **Windows**: `%APPDATA%/OpenRadius/.machine_identity`

## Backend Implementation

### Database Model

**MicroserviceApproval** (`Backend/Models/MicroserviceApproval.cs`):
```csharp
public class MicroserviceApproval
{
    public int Id { get; set; }
    public string ServiceName { get; set; }
    public string MachineId { get; set; }
    public string MachineName { get; set; }
    public string Platform { get; set; }
    public string ApprovalToken { get; set; }
    public bool IsApproved { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime LastConnectedAt { get; set; }
}
```

### Services

**MicroserviceApprovalService** (`Backend/Services/MicroserviceApprovalService.cs`):
- `ValidateConnectionAsync()` - Validates machine ID and token
- `RequestApprovalAsync()` - Creates new approval request
- `ApproveConnectionAsync()` - Approves pending connection
- `RevokeConnectionAsync()` - Revokes existing approval
- `GetPendingApprovalsAsync()` - Lists pending approvals
- `GetApprovedConnectionsAsync()` - Lists approved connections

### SignalR Hub Methods

**MicroservicesHub** (`Backend/Hubs/MicroservicesHub.cs`):

**Modified:**
- `RegisterService(serviceName, version, machineId, approvalToken, metadata)` - Now requires machine credentials

**New Methods:**
- `GetPendingApprovals()` - Returns list of pending approval requests
- `GetApprovedConnections()` - Returns list of approved connections
- `ApproveConnection(approvalId, approvedBy)` - Approves a pending request
- `RevokeConnection(approvalId)` - Revokes an approved connection

**New Events:**
- `RegistrationRejected` - Sent when registration is denied (pending/revoked)
- `PendingApprovalRequest` - Broadcast to dashboard when new approval needed
- `ApprovalUpdated` - Broadcast when approval status changes

## Microservice Implementation

### Machine Identity Service

**MachineIdentityService** (`microservices/RadiusSyncService/Services/MachineIdentityService.cs`):
- Generates and caches machine ID
- Persists approval token to local file
- Provides system information (machine name, platform)

### SignalR Connection Service

**Modified RegisterService**:
```csharp
var machineId = _machineIdentityService.GetMachineId();
var approvalToken = _machineIdentityService.GetApprovalToken();

await _hubConnection.InvokeAsync("RegisterService", 
    _serviceName, _serviceVersion, machineId, approvalToken, metadata);
```

**New Event Handlers:**
- `RegistrationRejected` - Handles rejection with detailed logging based on status

## Approval Workflow

### First-Time Connection

1. **Microservice starts** → Generates machine ID
2. **Attempts registration** → No approval token exists (uses placeholder)
3. **Backend validation fails** → No approval record found
4. **Backend creates approval request** → Generates secure token
5. **Backend sends `RegistrationRejected`** → Status: "pending"
6. **Backend broadcasts `PendingApprovalRequest`** → Notifies dashboard
7. **Microservice logs warning** → "Awaiting approval"

### Administrator Approval

1. **Admin opens approvals UI** (pending implementation)
2. **Reviews pending request** → See service name, machine name, platform
3. **Clicks "Approve"** → Calls `ApproveConnection(approvalId, approvedBy)`
4. **Backend updates database** → Sets `IsApproved = true`
5. **Backend broadcasts `ApprovalUpdated`** → Notifies all clients
6. **Microservice must reconnect** → Use saved token from logs

### Subsequent Connections

1. **Microservice starts** → Generates same machine ID
2. **Reads approval token** → From `~/.config/OpenRadius/.machine_identity`
3. **Attempts registration** → Sends machine ID + token
4. **Backend validates** → Token matches approved record
5. **Registration succeeds** → `RegistrationAcknowledged` sent
6. **Backend updates** → `LastConnectedAt` timestamp

### Revocation

1. **Admin clicks "Revoke"** → Calls `RevokeConnection(approvalId)`
2. **Backend updates database** → Sets `IsRevoked = true`
3. **If microservice connected** → Next registration attempt fails
4. **Backend sends `RegistrationRejected`** → Status: "revoked"
5. **Microservice logs error** → "Connection has been revoked"

## Security Features

1. **Machine-Specific Tokens**: Each machine gets a unique approval token
2. **HMAC-SHA256 Tokens**: Cryptographically secure token generation
3. **Hardware-Based ID**: Machine ID includes MAC addresses (hardware-specific)
4. **Revocation Support**: Approved connections can be revoked at any time
5. **Audit Trail**: Tracks who approved and when
6. **Last Connected**: Monitors when approved machines last connected

## Database Migration

Migration created: `20260121101950_AddMicroserviceApprovals`

Table created:
```sql
CREATE TABLE "MicroserviceApprovals" (
    "Id" SERIAL PRIMARY KEY,
    "ServiceName" TEXT NOT NULL,
    "MachineId" TEXT NOT NULL,
    "MachineName" TEXT NOT NULL,
    "Platform" TEXT NOT NULL,
    "ApprovalToken" TEXT NOT NULL,
    "IsApproved" BOOLEAN NOT NULL,
    "ApprovedAt" TIMESTAMP,
    "ApprovedBy" TEXT,
    "IsRevoked" BOOLEAN NOT NULL,
    "RevokedAt" TIMESTAMP,
    "LastConnectedAt" TIMESTAMP NOT NULL
);
```

## Testing the System

### First Connection
```bash
# Start the microservice
cd microservices/RadiusSyncService
dotnet run
```

Expected logs:
```
[Warning] Registration rejected - awaiting approval: This microservice connection requires approval
[Warning] Please contact an administrator to approve this microservice connection
```

Check the machine identity file:
```bash
cat ~/.config/OpenRadius/.machine_identity
```

You should see two lines:
- Line 1: Machine ID (SHA256 hash)
- Line 2: Empty (approval token will be added after first approval)

### Approve Connection

Using a REST client or future UI:
```bash
# Get pending approvals
curl -X GET http://localhost:5000/hubs/microservices/GetPendingApprovals

# Approve (replace ID and approvedBy)
curl -X POST http://localhost:5000/hubs/microservices/ApproveConnection \
  -H "Content-Type: application/json" \
  -d '{"approvalId": 1, "approvedBy": "admin@open-radius.org"}'
```

### Subsequent Connection
```bash
# Restart the microservice
dotnet run
```

Expected logs:
```
[Information] Registered with hub as RadiusSyncService v1.0.0 - Machine: abc123...
[Information] Service registration acknowledged
```

## Remaining Work

### Frontend UI (Not Implemented)

Needed components:
1. **Approval List Page** (`Frontend/src/pages/MicroserviceApprovals.tsx`)
   - Tab for "Pending Approvals"
   - Tab for "Approved Connections"
   - Approve/Reject buttons for pending
   - Revoke button for approved
   - Real-time updates via SignalR

2. **Notification System**
   - Toast notification when `PendingApprovalRequest` received
   - Badge on navigation showing pending count
   - Sound/visual alert for new requests

3. **Dashboard Integration**
   - Add "Approvals" link to main navigation
   - Show approval status in microservice cards
   - Display machine ID and last connected time

### API Endpoints (Optional)

If REST API access needed:
- `GET /api/approvals/pending` - List pending approvals
- `GET /api/approvals/approved` - List approved connections
- `POST /api/approvals/{id}/approve` - Approve connection
- `POST /api/approvals/{id}/revoke` - Revoke connection

## Files Modified/Created

### Backend
- ✅ `Backend/Models/MicroserviceApproval.cs` (NEW)
- ✅ `Backend/Services/MicroserviceApprovalService.cs` (NEW)
- ✅ `Backend/Data/ApplicationDbContext.cs` (MODIFIED - added DbSet)
- ✅ `Backend/Hubs/MicroservicesHub.cs` (MODIFIED - validation + approval methods)
- ✅ `Backend/Program.cs` (MODIFIED - registered service)
- ✅ `Backend/Migrations/20260121101950_AddMicroserviceApprovals.cs` (NEW)

### Microservice
- ✅ `microservices/RadiusSyncService/Services/MachineIdentityService.cs` (NEW)
- ✅ `microservices/RadiusSyncService/Services/SignalRConnectionService.cs` (MODIFIED)
- ✅ `microservices/RadiusSyncService/Program.cs` (MODIFIED - registered service)

### Frontend
- ❌ `Frontend/src/pages/MicroserviceApprovals.tsx` (PENDING)
- ❌ `Frontend/src/components/ApprovalNotification.tsx` (PENDING)
- ❌ Dashboard navigation updates (PENDING)

## Next Steps

1. **Restart Backend and Microservice**
   ```bash
   # Terminal 1: Backend
   cd Backend
   dotnet run
   
   # Terminal 2: Microservice  
   cd microservices/RadiusSyncService
   dotnet run
   ```

2. **Verify Approval Request**
   - Check microservice logs for "awaiting approval" message
   - Check backend logs for "Approval requested" message

3. **Test Manual Approval** (via SignalR)
   - Use SignalR test client to call `ApproveConnection`
   - Or wait for frontend UI implementation

4. **Build Frontend UI**
   - Create approval management page
   - Add real-time notifications
   - Integrate with dashboard

## Configuration

No additional configuration required. The system uses:
- Standard database connection (ApplicationDbContext)
- SignalR hub (already configured)
- Local file storage for machine identity

## Troubleshooting

### Microservice keeps getting rejected
- Check if approval exists: Query `MicroserviceApprovals` table
- Verify machine ID matches: Check `.machine_identity` file
- Ensure not revoked: `IsRevoked` should be `false`

### Machine ID changes on restart
- MAC addresses might be changing (unusual)
- Check network adapter configuration
- Verify `.machine_identity` file permissions

### Token mismatch
- Delete `.machine_identity` file
- Restart microservice (will create new approval request)
- Approve the new request

## Security Considerations

1. **Machine Identity File**: Stored in user's home directory, readable by user only
2. **Token Generation**: Uses cryptographically secure HMACSHA256
3. **No Plaintext Secrets**: Tokens are hashes, not reversible
4. **Audit Trail**: All approvals/revocations are logged with timestamps and user
5. **Revocation**: Compromised machines can be revoked instantly

## Future Enhancements

1. **Auto-Approval Rules**: Allow specific machines/networks to auto-approve
2. **Temporary Approvals**: Expire tokens after X days
3. **Multi-Tenant Support**: Scope approvals to workspaces
4. **Email Notifications**: Alert admins of new approval requests
5. **API Keys**: Alternative to machine-based approval
6. **Certificate-Based**: Use SSL certificates for authentication
