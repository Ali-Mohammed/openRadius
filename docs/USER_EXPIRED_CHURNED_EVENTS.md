# User Expired & User Churned — Automation Events

## Overview

OpenRadius automatically detects when RADIUS users expire or churn and fires automation events that trigger workflow automations in the designer. This enables ISP operators to build automated responses to user lifecycle transitions — such as sending notifications, suspending accounts, or calling external APIs.

---

## Key Concepts

| Term | Definition |
|---|---|
| **Expired User** | A RADIUS user whose `Expiration` datetime has passed (`Expiration < now`) |
| **Churned User** | A RADIUS user who has been expired for more than N days (default: **30 days**) without renewal |
| **Automation Event** | A domain event object that carries user context data and triggers matching workflow automations |
| **Lifecycle Detection** | A Hangfire background job that periodically scans for expired/churned users |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Hangfire Scheduler                        │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │ detect-expired-users│    │  detect-churned-users        │ │
│  │ (every 5 minutes)   │    │  (every 60 minutes)          │ │
│  └────────┬────────────┘    └────────────┬─────────────────┘ │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────────────────────────────────────────┐
│              UserLifecycleEventService                     │
│                                                           │
│  1. Check: any active automations with matching trigger?  │
│  2. Query: users with Expiration < cutoff                 │
│  3. Deduplicate: exclude already-processed users          │
│  4. Fire: AutomationEvent per new user                    │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────────┐
│                AutomationEngineService                     │
│                                                           │
│  1. Deserialize event                                     │
│  2. Find automations with matching trigger nodes          │
│  3. Traverse workflow graph (actions, conditions)          │
│  4. Execute HTTP requests, evaluate conditions             │
│  5. Log execution in AutomationExecutionLogs              │
└───────────────────────────────────────────────────────────┘
```

---

## How It Works

### User Expired Detection

**Schedule:** Every **5 minutes** (cron: `*/5 * * * *`)

**Service:** `UserLifecycleEventService.DetectExpiredUsersAsync`

**Flow:**

1. **Guard check** — Queries `Automations` table to see if any active automation has `TriggerType = "on_action"` and its `WorkflowJson` contains `"user-expired"`. If none exist, the job exits immediately (zero overhead).

2. **Find already-processed users** — Queries `AutomationExecutionLogs` for all entries with `TriggerType = "user-expired"` and `Status = "completed"` or `"completed_with_errors"`. Extracts distinct `RadiusUserId` values into a HashSet for O(1) lookup.

3. **Find expired users** — Queries `RadiusUsers` where:
   - `Expiration IS NOT NULL`
   - `Expiration < DateTime.UtcNow` (expiration date has passed)
   - `IsDeleted = false`
   - Orders by `Expiration` ascending (oldest first)
   - Limited to **100 users per batch** (prevents memory spikes)

4. **Filter out duplicates** — Removes users whose IDs are in the already-fired set.

5. **Fire events** — For each new expired user, creates an `AutomationEvent` with:
   - `EventType = UserExpired`
   - `TriggerType = "user-expired"`
   - Full user context (username, email, phone, balance, profile, group, zone, enabled status, expiration date)
   - `PerformedBy = "System (Lifecycle Detection)"`

6. **Engine processes** — The `AutomationEngineService` receives the event, matches it against all active automations with `"user-expired"` trigger nodes, and executes matched workflows.

7. **Execution logged** — Each execution creates an `AutomationExecutionLog` entry with `TriggerType = "user-expired"` and `RadiusUserId` — this is what prevents the same user from being processed again on the next run.

### User Churned Detection

**Schedule:** Every **60 minutes** (cron: `0 * * * *`)

**Service:** `UserLifecycleEventService.DetectChurnedUsersAsync`

**Flow:** Same as expired detection, with these differences:

1. **Churn threshold** — Configurable via `appsettings.json`:
   ```json
   {
     "Automation": {
       "ChurnThresholdDays": 30
     }
   }
   ```
   Default: **30 days**. A user is "churned" when `Expiration < (now - 30 days)`.

2. **Query condition** — Finds users where `Expiration < churnCutoff` (expired for at least N days).

3. **Extra context data** — The automation event includes:
   - `daysExpired` — How many days since expiration (e.g., 45)
   - `churnThresholdDays` — The configured threshold (e.g., 30)

4. **Deduplication** — Checks `AutomationExecutionLogs` with `TriggerType = "user-churned"`.

---

## Timeline Example

```
Day 0          Day 1          Day 5          Day 30         Day 31
  │              │              │              │              │
  │  User        │              │              │              │
  │  Created     │              │              │              │
  │              │              │              │              │
  ▼              │              │              │              │
  ───────────────┼──────────────┼──────────────┼──────────────┤
                 │              │              │              │
                 ▼              │              │              │
            Expiration         │              │              │
            Date Passes        │              │              │
                 │              │              │              │
                 │  ┌───────────┘              │              │
                 │  │                          │              │
                 │  ▼                          │              │
                 │  user-expired               │              │
                 │  event fires                │              │
                 │  (within 5 min)             │              │
                 │                             │              │
                 │                             ▼              │
                 │                        30 days since       │
                 │                        expiration          │
                 │                             │              │
                 │                             │  ┌───────────┘
                 │                             │  │
                 │                             │  ▼
                 │                             │  user-churned
                 │                             │  event fires
                 │                             │  (within 60 min)
```

---

## Deduplication Strategy

Events are fired **exactly once per user** per event type. The deduplication relies on `AutomationExecutionLogs`:

| Check | Query |
|---|---|
| Already expired? | `SELECT DISTINCT RadiusUserId FROM AutomationExecutionLogs WHERE TriggerType = 'user-expired' AND Status IN ('completed', 'completed_with_errors')` |
| Already churned? | `SELECT DISTINCT RadiusUserId FROM AutomationExecutionLogs WHERE TriggerType = 'user-churned' AND Status IN ('completed', 'completed_with_errors')` |

**Important:** If a user's subscription is renewed (expiration pushed forward) and then expires again later, a new `user-expired` event will NOT fire automatically because the previous execution log still exists. To re-trigger, the operator would need to clear the old execution log or the system would need a more sophisticated reset mechanism (not currently implemented — can be added if needed).

---

## Event Context Data

Both events carry rich context data that can be used in workflow conditions and HTTP request templates:

### user-expired Context

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "phone": "+964123456789",
  "enabled": true,
  "balance": 15000.00,
  "profileId": 5,
  "expiration": "2026-02-15T00:00:00.0000000Z",
  "groupId": 3,
  "zoneId": 2,
  "triggerSource": "lifecycle_expired_detection"
}
```

### user-churned Context

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "phone": "+964123456789",
  "enabled": true,
  "balance": 15000.00,
  "profileId": 5,
  "expiration": "2026-01-15T00:00:00.0000000Z",
  "groupId": 3,
  "zoneId": 2,
  "daysExpired": 34,
  "churnThresholdDays": 30,
  "triggerSource": "lifecycle_churn_detection"
}
```

### Using Context in Workflow Templates

In the workflow designer's HTTP action nodes, context values can be referenced using template syntax:

```
URL:    https://sms-api.example.com/send
Body:   {
          "phone": "{{event.phone}}",
          "message": "Dear {{event.username}}, your subscription expired {{event.daysExpired}} days ago. Renew now!"
        }
```

---

## Workflow Designer Setup

### Step 1: Create an Automation

1. Navigate to **Billing → Automations**
2. Click **Create Automation**
3. Set **Trigger Type** to **On Action** (event-based)
4. Give it a name (e.g., "Notify Expired Users")
5. Set status to **Active**

### Step 2: Design the Workflow

1. Open the automation's **Designer** page
2. From the sidebar, drag a **User Expired** or **User Churned** trigger node onto the canvas
3. Connect it to action nodes (e.g., HTTP Request to send SMS/email)
4. Optionally add condition nodes to filter (e.g., only if balance > 0)

### Step 3: Example Workflows

#### Example 1: Send SMS When User Expires

```
[User Expired] → [HTTP Request: Send SMS API]
```

HTTP Action configuration:
- **Method:** POST
- **URL:** `https://sms-gateway.example.com/api/send`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer {{apiKey}}`
- **Body:**
  ```json
  {
    "to": "{{event.phone}}",
    "message": "Your internet subscription has expired. Please renew to continue service."
  }
  ```

#### Example 2: Suspend Account + Notify on Churn

```
[User Churned] → [Condition: balance == 0?]
                      ├── True  → [HTTP: Suspend User API] → [HTTP: Send Final Notice SMS]
                      └── False → [HTTP: Send Reminder SMS with Balance Info]
```

#### Example 3: Multi-step Expiration Workflow

```
[User Expired] → [HTTP: Send Expiry Email]
               → [HTTP: Log to External CRM]
               → [HTTP: Notify Admin via Slack Webhook]
```

---

## Hangfire Job Details

### Job Registration

Jobs are registered at application startup in `Program.cs` for each active workspace:

| Job ID Pattern | Schedule | Method |
|---|---|---|
| `workspace_{id}_detect-expired-users` | `*/5 * * * *` (every 5 min) | `DetectExpiredUsersAsync` |
| `workspace_{id}_detect-churned-users` | `0 * * * *` (every hour) | `DetectChurnedUsersAsync` |

### Job Behavior

| Aspect | Detail |
|---|---|
| **Retry on failure** | Yes — Hangfire automatic retry (default: 10 retries with exponential backoff) |
| **Concurrency** | One instance per workspace at a time (Hangfire recurring job guarantee) |
| **Batch size** | 100 users max per run (processes oldest first, catches up over multiple runs) |
| **No-op when idle** | If no active automations use the trigger type, the job exits immediately with zero DB queries against `RadiusUsers` |
| **Multi-tenant** | Each workspace has its own pair of jobs with workspace-scoped database connections |
| **Timezone** | UTC |

### Monitoring

Jobs are visible in the Hangfire Dashboard:
- Navigate to `/hangfire` in the application
- Check **Recurring Jobs** tab for `workspace_*_detect-expired-users` and `workspace_*_detect-churned-users`
- Check **Succeeded** / **Failed** tabs for execution history

---

## Configuration

### appsettings.json

```json
{
  "Automation": {
    "ChurnThresholdDays": 30
  }
}
```

| Setting | Type | Default | Description |
|---|---|---|---|
| `Automation:ChurnThresholdDays` | `int` | `30` | Number of days after expiration before a user is considered churned |

### Adjusting Detection Frequency

To change how often the detection runs, modify the cron expressions in `Program.cs`:

```csharp
// Detect expired users every 10 minutes instead of 5
"*/10 * * * *"

// Detect churned users every 6 hours instead of hourly
"0 */6 * * *"
```

---

## All Automation Event Types

| Event Type | Trigger String | How It Fires | When |
|---|---|---|---|
| `UserCreated` | `user-created` | RadiusUserController → `POST /api/radius/users` | Immediately on user creation |
| `UserUpdated` | `user-updated` | RadiusUserController → `PUT /api/radius/users/uuid/{uuid}` | Immediately on user update |
| `UserActivated` | `user-activated` | RadiusActivationController → activation endpoint | Immediately on activation |
| **`UserExpired`** | **`user-expired`** | **UserLifecycleEventService → Hangfire recurring job** | **Within 5 minutes of expiration** |
| **`UserChurned`** | **`user-churned`** | **UserLifecycleEventService → Hangfire recurring job** | **Within 60 minutes of churn threshold** |
| `PaymentReceived` | `payment-received` | PaymentsController → `ProcessSuccessfulPayment` | Immediately on successful payment |
| `UserDeleted` | `user-deleted` | RadiusUserController → `DELETE /api/radius/users/uuid/{uuid}` | Immediately on soft delete |
| `Scheduled` | `scheduled` | AutomationSchedulerService → Hangfire cron/at_time | On schedule |
| `ManualRequest` | `manual-request` | AutomationController → test endpoint | On manual test run |

---

## Files Involved

| File | Role |
|---|---|
| `Backend/Services/UserLifecycleEventService.cs` | Core detection service — scans for expired/churned users and fires events |
| `Backend/Services/AutomationEngineService.cs` | Processes fired events, matches triggers, executes workflows |
| `Backend/Models/Billing/AutomationEvent.cs` | Event model, enum (`UserExpired`, `UserChurned`), trigger type mapping |
| `Backend/Program.cs` | DI registration + Hangfire recurring job setup |
| `Frontend/src/pages/WorkflowDesigner.tsx` | Designer UI — trigger palette with "User Expired" and "User Churned" options |
| `Frontend/src/components/workflow/TriggerNode.tsx` | Trigger node rendering with appropriate icons |
| `Frontend/src/components/workflow/ExecutionHistoryPanel.tsx` | Execution history display with trigger labels |

---

## Troubleshooting

### Events Not Firing

1. **Check automation is active** — The automation must have `Status = "active"`, `IsActive = true`, and `TriggerType = "on_action"`
2. **Check workflow has trigger node** — The automation's workflow JSON must contain a trigger node with type `"user-expired"` or `"user-churned"`
3. **Check user has expiration** — The `RadiusUser.Expiration` field must be set (non-null) and in the past
4. **Check Hangfire dashboard** — Look at `/hangfire` for job execution status and any errors
5. **Check execution logs** — If the event already fired for that user, it won't fire again (by design)

### Events Firing But Workflow Not Executing

1. **Check automation engine logs** — Search for `[Hangfire] Processing automation event` in application logs
2. **Check execution history** — In the designer, open the execution history panel to see if the run completed or failed
3. **Check HTTP action configuration** — Verify URLs, headers, and body templates are correct

### Reset: Re-trigger Events for a User

If a user renewed and you want the expired event to fire again on the next expiration:
- Delete the corresponding `AutomationExecutionLog` entry for that user and trigger type
- The next detection run will treat the user as "new" and fire the event

---

## Performance Considerations

| Aspect | Strategy |
|---|---|
| **Batch processing** | Max 100 users per run; catches up over multiple runs |
| **Early exit** | If no active automations use the trigger type, exits immediately |
| **Efficient deduplication** | HashSet lookup (O(1) per user) |
| **Workspace isolation** | Each workspace has independent jobs and database |
| **Minimal queries** | Only 3 DB queries per run: check automations, get logs, get users |
