# Custom Cashback Settings Implementation

## Overview
This feature allows individual user wallets to override global cashback settings with wallet-specific configurations.

## Database Schema

### UserWallets Table - New Columns
```sql
ALTER TABLE "UserWallets" 
ADD COLUMN "UsesCustomCashbackSetting" boolean NOT NULL DEFAULT false,
ADD COLUMN "CustomCashbackType" text,
ADD COLUMN "CustomCashbackCollectionSchedule" text,
ADD COLUMN "CustomCashbackMinimumCollectionAmount" numeric(18,2),
ADD COLUMN "CustomCashbackRequiresApproval" boolean;
```

## Backend Implementation

### Models (`Backend/Models/UserWallet.cs`)
```csharp
public bool UsesCustomCashbackSetting { get; set; } = false;
public string? CustomCashbackType { get; set; } // "Instant" or "Collected"
public string? CustomCashbackCollectionSchedule { get; set; } // "AnyTime", "EndOfWeek", "EndOfMonth"
public decimal? CustomCashbackMinimumCollectionAmount { get; set; }
public bool? CustomCashbackRequiresApproval { get; set; }
```

### DTOs (`Backend/Controllers/UserWalletController.cs`)
Both `CreateUserWalletRequest` and `UpdateUserWalletRequest` include:
- UsesCustomCashbackSetting
- CustomCashbackType
- CustomCashbackCollectionSchedule
- CustomCashbackMinimumCollectionAmount
- CustomCashbackRequiresApproval

### API Endpoints
All User Wallet endpoints now return cashback settings:
- `GET /api/user-wallets` - Returns list with cashback settings
- `GET /api/user-wallets/{id}` - Returns single wallet with cashback settings
- `POST /api/user-wallets` - Creates wallet with cashback settings
- `PUT /api/user-wallets/{id}` - Updates wallet with cashback settings

### Integration (`Backend/Controllers/RadiusActivationController.cs`)

The activation controller now checks wallet-specific settings before using global settings:

```csharp
if (userWallet.UsesCustomCashbackSetting && !string.IsNullOrEmpty(userWallet.CustomCashbackType))
{
    // Use wallet-specific cashback settings
    transactionType = userWallet.CustomCashbackType;
    requiresApproval = userWallet.CustomCashbackRequiresApproval ?? false;
}
else
{
    // Get cashback settings from master database (global settings)
    var cashbackSettings = await _masterContext.CashbackSettings
        .OrderByDescending(cs => cs.CreatedAt)
        .FirstOrDefaultAsync();
    transactionType = cashbackSettings?.TransactionType ?? "Instant";
    requiresApproval = cashbackSettings?.RequiresApprovalToCollect ?? false;
}
```

This logic is applied for:
- Standard user cashback (lines ~580-610)
- Sub-agent supervisor cashback (lines ~716-740)

## Frontend Implementation

### Type Definition (`Frontend/src/api/userWallets.ts`)
```typescript
export interface UserWallet {
  // ... existing fields
  usesCustomCashbackSetting?: boolean
  customCashbackType?: string | null
  customCashbackCollectionSchedule?: string | null
  customCashbackMinimumCollectionAmount?: number | null
  customCashbackRequiresApproval?: boolean | null
}
```

### User Interface (`Frontend/src/pages/billing/UserWallets.tsx`)

Added a collapsible section in the wallet edit dialog with:

1. **Toggle Switch**: "Custom Cashback Settings"
   - Enables/disables wallet-specific cashback configuration

2. **Cashback Type Select** (when enabled):
   - "Instant - Credit immediately"
   - "Collected - Requires collection"

3. **Collection Settings** (when type is "Collected"):
   - **Collection Schedule**: AnyTime / End of Week / End of Month
   - **Minimum Collection Amount**: Numeric input (e.g., 100.00)
   - **Requires Approval**: Checkbox for supervisor approval requirement

## Usage Flow

### Setting Up Custom Cashback
1. Navigate to **Billing → User Wallets** (http://localhost:5173/billing/user-wallets)
2. Click **Edit** on a wallet
3. Enable the **"Custom Cashback Settings"** switch
4. Configure:
   - **Cashback Type**: Choose Instant or Collected
   - For Collected type:
     - Set collection schedule (optional)
     - Set minimum amount threshold (optional)
     - Enable supervisor approval requirement (optional)
5. Click **Update**

### How It Works
When a radius activation occurs:
1. System checks if the wallet has `UsesCustomCashbackSetting = true`
2. If true, uses wallet-specific settings (`CustomCashbackType`, etc.)
3. If false, falls back to global cashback settings from master database
4. Creates cashback transaction based on the effective settings

## Cashback Types Explained

### Instant Cashback
- Money is credited to wallet immediately
- No approval needed
- Status: "Completed"
- Balance updated right away

### Collected Cashback
- Money is held for user collection
- Status: "Pending" or "WaitingForApproval" (based on settings)
- Balance NOT updated until collected
- Can have schedule restrictions (End of Week/Month)
- Can have minimum amount threshold
- Can require supervisor approval

## Examples

### Example 1: VIP User with High Minimum
```json
{
  "usesCustomCashbackSetting": true,
  "customCashbackType": "Collected",
  "customCashbackCollectionSchedule": "EndOfMonth",
  "customCashbackMinimumCollectionAmount": 1000.00,
  "customCashbackRequiresApproval": false
}
```
Result: Cashback accumulates until end of month, requires minimum $1000 to collect.

### Example 2: Corporate Account with Approval
```json
{
  "usesCustomCashbackSetting": true,
  "customCashbackType": "Collected",
  "customCashbackCollectionSchedule": "AnyTime",
  "customCashbackMinimumCollectionAmount": null,
  "customCashbackRequiresApproval": true
}
```
Result: Cashback can be collected anytime but requires supervisor approval.

### Example 3: Standard User (Global Settings)
```json
{
  "usesCustomCashbackSetting": false,
  "customCashbackType": null,
  "customCashbackCollectionSchedule": null,
  "customCashbackMinimumCollectionAmount": null,
  "customCashbackRequiresApproval": null
}
```
Result: Uses workspace global cashback settings from CashbackSettings table.

## Migration Notes

- Migration file: `Backend/Migrations/ApplicationDb/20260124_AddCustomCashbackSettingsToUserWallet.cs`
- Applied manually via Docker SQL due to previous migration index conflict
- All existing wallets default to `UsesCustomCashbackSetting = false` (global settings)
- Backward compatible: No breaking changes

## Testing Checklist

- [x] Database columns created
- [x] Backend DTOs updated
- [x] GET endpoints return cashback fields
- [x] POST endpoint accepts and saves cashback fields
- [x] PUT endpoint updates cashback fields
- [x] RadiusActivationController uses wallet settings when enabled
- [x] Frontend UI displays toggle and conditional fields
- [x] Frontend form submission includes cashback data
- [ ] Test activation with Instant custom cashback
- [ ] Test activation with Collected custom cashback
- [ ] Test activation with global settings (toggle off)
- [ ] Test supervisor cashback with custom settings
- [ ] Test collection schedule enforcement
- [ ] Test minimum amount threshold
- [ ] Test approval workflow

## Future Enhancements

1. Bulk update cashback settings for multiple wallets
2. Cashback analytics per wallet
3. Wallet-level cashback collection history
4. Cashback settings templates for quick assignment
5. Validation rules for minimum amounts and schedules
