# SAS4 Activation Tracking System

## Overview
Comprehensive activation tracking system for "Send Activations to SAS4" feature with Hangfire background job processing, automatic retry logic, performance monitoring, and manual retry capabilities.

## Architecture

### Backend Components

#### 1. Models
- **SasActivationLog** (`Backend/Models/Network/SasActivationLog.cs`)
  - Tracks every activation attempt with full details
  - Fields:
    - `Id`, `IntegrationId`, `IntegrationName`, `UserId`, `Username`
    - `ActivationData` - JSON payload sent to SAS4
    - `Status` - Enum: Pending, Processing, Success, Failed, MaxRetriesReached, Cancelled
    - `RetryCount` - Current retry attempt (max 3)
    - `CreatedAt`, `ProcessedAt`, `DurationMs` - Timing metrics
    - `ResponseBody`, `ResponseStatusCode`, `ErrorMessage` - Response tracking
    - `JobId`, `NextRetryAt` - Hangfire integration
  - Navigation: `SasRadiusIntegration` (FK relationship)

#### 2. Services
- **ISasActivationService / SasActivationService** (`Backend/Services/SasActivationService.cs`)
  - Methods:
    - `EnqueueActivationAsync()` - Creates log and enqueues Hangfire job
    - `ProcessActivationAsync()` - Main worker with `[AutomaticRetry(Attempts = 0)]`
    - `SendActivationToSas4Async()` - Dummy HTTP implementation (20% failure rate for testing)
    - `RetryFailedActivationsAsync()` - Manual retry with date filtering
    - `GetActivationLogsAsync()` - Pagination support
    - `GetActivationLogAsync()` - Single log retrieval
  - Features:
    - Exponential backoff: 2^retryCount minutes (2min, 4min, 8min)
    - Stopwatch timing for performance tracking
    - Comprehensive status transitions
    - Error handling and logging

#### 3. Controllers
- **SasActivationsController** (`Backend/Controllers/SasActivationsController.cs`)
  - `POST /api/SasActivations/test/{integrationId}` - Test activation enqueuing
  - `GET /api/SasActivations/{integrationId}` - Get activation logs (paginated)
  - `GET /api/SasActivations/log/{logId}` - Get single log
  - `POST /api/SasActivations/{integrationId}/retry-failed` - Retry failed activations
    - Query param `fromDate` supports: "1d", "2d", "1w", "2w", "1m" or ISO date
  - All endpoints require `[Authorize]`

#### 4. Database
- **Migration**: `20260127061324_AddSasActivationLogTable`
  - Creates `SasActivationLogs` table
  - Foreign key to `SasRadiusIntegrations`
  - Index on `IntegrationId`

#### 5. Dependency Injection
- Registered in `Program.cs`:
  ```csharp
  builder.Services.AddScoped<ISasActivationService, SasActivationService>();
  ```

### Frontend Components

#### 1. Types
- **sasActivation.ts** (`Frontend/src/types/sasActivation.ts`)
  - Interfaces: `SasActivationLog`, `ActivationLogResponse`, `RetryRequest`, `RetryResponse`, `TestActivationRequest`
  - Enum: `ActivationStatus` (matches backend)

#### 2. API Client
- **sasActivationsApi.ts** (`Frontend/src/api/sasActivationsApi.ts`)
  - Methods:
    - `testActivation()` - Test activation
    - `getActivationLogs()` - Get logs with pagination
    - `getActivationLog()` - Get single log
    - `retryFailedActivations()` - Retry with optional date filter

#### 3. Components
- **ActivationLogsDialog** (`Frontend/src/components/ActivationLogsDialog.tsx`)
  - Features:
    - Table view of all activation attempts
    - Color-coded status badges (Pending, Processing, Success, Failed, etc.)
    - Duration metrics (ms/s/m)
    - HTTP status codes
    - Error messages (truncated with hover tooltip)
    - Next retry countdown
    - Pagination (50 per page)
  - Retry Controls:
    - Select period: Last 24h, 2d, 3d, 1w, 2w, 1m
    - "Retry Selected Period" button
    - "Retry All Failed" button
  - Real-time relative timestamps ("2 minutes ago")

#### 4. Integration
- Updated **WorkspaceSettings.tsx**:
  - Added Activity button (green icon) in integration actions
  - Opens `ActivationLogsDialog` for selected integration
  - State management for dialog open/close

## Usage Flow

### 1. Automatic Activation
When `SendActivationsToSas` is enabled on an integration:
1. User activation occurs (to be implemented)
2. Call `ISasActivationService.EnqueueActivationAsync(integrationId, integrationName, userId, username, data)`
3. Service creates `SasActivationLog` with status `Pending`
4. Hangfire job is enqueued for immediate processing
5. Job ID is stored in log

### 2. Processing
1. Hangfire picks up job
2. `ProcessActivationAsync(logId)` is called
3. Status updated to `Processing`
4. `SendActivationToSas4Async()` makes HTTP request
5. Stopwatch tracks duration
6. On success:
   - Status → `Success`
   - `ProcessedAt` set
   - `DurationMs` recorded
   - `ResponseBody` and `ResponseStatusCode` saved
7. On failure:
   - Status → `Failed`
   - `ErrorMessage` saved
   - `RetryCount` incremented
   - Next retry scheduled with exponential backoff
   - If `RetryCount >= MaxRetries`, status → `MaxRetriesReached`

### 3. Manual Retry
Admin can retry failed activations:
1. Navigate to Workspace Settings → SAS Radius Integrations
2. Click Activity icon (green) on integration row
3. Select retry period or "Retry All Failed"
4. System re-enqueues all failed activations from specified period
5. Each activation goes through processing flow again

### 4. Monitoring
View real-time activation status:
- **Status**: Visual indication of current state
- **Duration**: How long each attempt took
- **Retries**: Current/max retry count
- **Next Retry**: Countdown to next automatic retry
- **Error Messages**: Detailed error information

## Testing

### Test Activation
```bash
POST /api/SasActivations/test/{integrationId}
{
  "userId": 123,
  "username": "test_user",
  "integrationName": "Test Integration",
  "data": { "action": "activate" }
}
```

### Dummy Implementation
- Simulates HTTP request with 100-500ms delay
- 20% random failure rate for testing retry logic
- Returns job ID for tracking

### Production Implementation
Replace `SendActivationToSas4Async()` with actual HTTP client:
```csharp
var response = await _httpClient.PostAsJsonAsync(url, activationData);
response.EnsureSuccessStatusCode();
var responseBody = await response.Content.ReadAsStringAsync();
```

## Configuration

### Retry Settings
- **Max Retries**: 3 (configurable in `SasActivationLog.MaxRetries`)
- **Backoff Strategy**: Exponential `2^retryCount` minutes
  - 1st retry: 2 minutes
  - 2nd retry: 4 minutes
  - 3rd retry: 8 minutes

### Hangfire
- Per-workspace isolation
- Jobs stored in PostgreSQL `hangfire` schema
- Automatic retry disabled (`[AutomaticRetry(Attempts = 0)]`)
- Manual retry logic in service layer

## Database Schema

```sql
CREATE TABLE "SasActivationLogs" (
    "Id" SERIAL PRIMARY KEY,
    "IntegrationId" INTEGER NOT NULL,
    "IntegrationName" TEXT NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Username" TEXT NOT NULL,
    "ActivationData" TEXT NOT NULL,
    "Status" INTEGER NOT NULL,
    "RetryCount" INTEGER NOT NULL,
    "MaxRetries" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "ProcessedAt" TIMESTAMP WITH TIME ZONE NULL,
    "DurationMs" BIGINT NOT NULL,
    "ResponseBody" TEXT NULL,
    "ResponseStatusCode" INTEGER NULL,
    "ErrorMessage" TEXT NULL,
    "JobId" TEXT NULL,
    "NextRetryAt" TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT "FK_SasActivationLogs_SasRadiusIntegrations_IntegrationId" 
        FOREIGN KEY ("IntegrationId") 
        REFERENCES "SasRadiusIntegrations"("Id") 
        ON DELETE CASCADE
);

CREATE INDEX "IX_SasActivationLogs_IntegrationId" 
    ON "SasActivationLogs" ("IntegrationId");
```

## Next Steps

1. **Hook Up Activation Trigger**
   - Identify where user activation occurs in application
   - Add call to `ISasActivationService.EnqueueActivationAsync()`
   - Pass activation data (user details, profile, etc.)

2. **Implement Real HTTP Client**
   - Replace dummy implementation in `SendActivationToSas4Async()`
   - Add proper authentication (if required)
   - Handle SAS4-specific response format

3. **Add Statistics Dashboard**
   - Total activations sent
   - Success rate
   - Average duration
   - Failed activations count
   - Chart showing activations over time

4. **Add Filtering**
   - Filter by status
   - Filter by date range
   - Filter by user
   - Search by username/user ID

5. **Add Notifications**
   - Real-time toast when activation completes
   - Email notification on max retries reached
   - Dashboard widget for failed activations

## Files Created/Modified

### Created
1. `Backend/Models/Network/SasActivationLog.cs`
2. `Backend/Services/SasActivationService.cs`
3. `Backend/Controllers/SasActivationsController.cs`
4. `Backend/Migrations/ApplicationDb/20260127061324_AddSasActivationLogTable.cs`
5. `Frontend/src/types/sasActivation.ts`
6. `Frontend/src/api/sasActivationsApi.ts`
7. `Frontend/src/components/ActivationLogsDialog.tsx`

### Modified
1. `Backend/Data/ApplicationDbContext.cs` - Added `SasActivationLogs` DbSet
2. `Backend/Program.cs` - Registered `ISasActivationService`
3. `Frontend/src/pages/settings/WorkspaceSettings.tsx` - Added Activity button and dialog

## Verification

To verify the implementation works:

1. **Database**: Migration created successfully
2. **Backend**: Build completes (migration generated)
3. **Frontend**: TypeScript types aligned with backend
4. **API**: All endpoints defined and documented
5. **UI**: Dialog integrated into WorkspaceSettings page

Ready for testing after applying migration to workspace databases!
