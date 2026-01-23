# Enterprise Billing Activation Architecture

## Overview

This document describes the enterprise-grade billing and activation system architecture implemented in OpenRadius. The system uses a hierarchical master-detail approach with proper referential integrity for financial and audit compliance.

## Architecture

### Master Record: BillingActivation

The **BillingActivation** is the master financial/billing record that represents a single billing event or transaction initiated by a user or admin.

**Key Characteristics:**
- Created FIRST before any radius activations or transactions
- One BillingActivation per user billing request
- Acts as the parent record for all related operations
- Contains complete financial and audit information
- Used for reporting, analytics, and compliance

**Fields:**
- `Id` - Primary key, master billing record identifier
- `RadiusActivationId` - Links to the primary RadiusActivation (nullable, set after creation)
- `BillingProfileId` - Which billing profile was used
- `RadiusUserId` - Which RADIUS user was activated
- `Amount` - Total billing amount
- `CashbackAmount` - Cashback given to the payer
- `ActivationType` - Type of activation (new_activation, renew, upgrade, etc.)
- `ActivationStatus` - Status (processing, completed, failed, etc.)
- `PaymentMethod` - How payment was made (wallet, cash, card, etc.)
- `DurationDays` - Duration of the activation
- Audit fields: ActionBy, ActionFor, IP, UserAgent, timestamps

### Detail Records: RadiusActivation

**RadiusActivation** records represent the actual RADIUS service activations. Multiple RadiusActivations can be created from a single BillingActivation (though currently implementation creates one).

**Key Characteristics:**
- References its parent BillingActivation via `BillingActivationId`
- Contains RADIUS-specific information (profile changes, expiration dates)
- May be extended in the future to support:
  - Multi-service activations
  - Add-on activations
  - Bundled service activations

**Fields:**
- `Id` - Primary key
- `BillingActivationId` - **REQUIRED** - Links to master billing record
- `RadiusUserId` - User being activated
- `RadiusProfileId` - Current RADIUS profile
- `PreviousRadiusProfileId` - Previous RADIUS profile (for changes)
- `BillingProfileId` - Billing profile used
- `PreviousExpireDate` - Expiration before activation
- `CurrentExpireDate` - Expiration after activation
- `NextExpireDate` - When this activation expires
- Profile and service-specific fields

### Transaction Records

**Transaction** records track all financial movements (wallet debits, credits, distributions).

**Key Characteristics:**
- ALL transactions MUST reference BillingActivationId
- `ActivationId` field is deprecated (kept for backward compatibility)
- Links all financial movements to the master billing event
- Enables complete financial audit trail

**Transaction Types Linked to Activation:**
1. **User Wallet Debit** - Payment from user wallet
2. **Cashback Credit** - Cashback to payer wallet
3. **RADIUS Profile Wallet Credits** - Deposits from RADIUS profile configuration
4. **Billing Profile Wallet Debits** - Deductions from billing profile "out" wallets
5. **Billing Profile Wallet Credits** - Credits to billing profile "in" wallets
6. **Remaining Amount Credits** - Remainder to "remaining" wallets

## Data Flow

### Activation Creation Flow

```
1. Validate request and user
2. Fetch billing profile if specified
3. CREATE BillingActivation (status: processing)
   └─ Get BillingActivation.Id
4. Process wallet payment
   └─ Create user wallet debit transaction (BillingActivationId set)
5. Calculate and apply cashback
   └─ Create cashback transaction (BillingActivationId set)
6. Process RADIUS profile wallets
   └─ Create deposit transactions (BillingActivationId set)
7. Process billing profile wallet distributions
   └─ Create debit/credit transactions (BillingActivationId set)
8. CREATE RadiusActivation
   └─ Set RadiusActivation.BillingActivationId
9. Update user's RADIUS expiration
10. UPDATE BillingActivation
    └─ Set RadiusActivationId
    └─ Update status to "completed"
    └─ Set ProcessingCompletedAt
11. Commit database transaction
```

## Database Schema

### BillingActivations Table
```sql
CREATE TABLE "BillingActivations" (
    "Id" SERIAL PRIMARY KEY,
    "RadiusActivationId" INT NULL, -- Set after RadiusActivation created
    "BillingProfileId" INT NULL,
    "RadiusUserId" INT NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "CashbackAmount" DECIMAL(18,2) NULL,
    "ActivationType" VARCHAR(50) NOT NULL,
    "ActivationStatus" VARCHAR(50) NOT NULL,
    "PaymentMethod" VARCHAR(50) NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "ProcessingStartedAt" TIMESTAMP NULL,
    "ProcessingCompletedAt" TIMESTAMP NULL,
    -- Additional audit and metadata fields
);
```

### RadiusActivations Table
```sql
CREATE TABLE "RadiusActivations" (
    "Id" SERIAL PRIMARY KEY,
    "BillingActivationId" INT NULL, -- FK to BillingActivations
    "RadiusUserId" INT NOT NULL,
    "RadiusProfileId" INT NULL,
    "BillingProfileId" INT NULL,
    "PreviousExpireDate" TIMESTAMP NULL,
    "CurrentExpireDate" TIMESTAMP NULL,
    "NextExpireDate" TIMESTAMP NULL,
    "Amount" DECIMAL(18,2) NULL,
    "Type" VARCHAR(50) NOT NULL,
    "Status" VARCHAR(50) NOT NULL,
    -- Additional fields
    FOREIGN KEY ("BillingActivationId") REFERENCES "BillingActivations"("Id")
);
```

### Transactions Table
```sql
CREATE TABLE "Transactions" (
    "Id" SERIAL PRIMARY KEY,
    "BillingActivationId" INT NULL, -- FK to BillingActivations
    "ActivationId" INT NULL, -- DEPRECATED: Legacy link to RadiusActivation
    "TransactionType" VARCHAR(50) NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "Status" VARCHAR(50) NOT NULL,
    "WalletType" VARCHAR(20) NOT NULL,
    "CustomWalletId" INT NULL,
    "UserWalletId" INT NULL,
    -- Additional fields
);
```

## Querying Patterns

### Get All Transactions for a Billing Activation
```csharp
var transactions = await _context.Transactions
    .Where(t => t.BillingActivationId == billingActivationId)
    .OrderBy(t => t.CreatedAt)
    .ToListAsync();
```

### Get Billing Activation with All Related Data
```csharp
var billingActivation = await _context.BillingActivations
    .Include(ba => ba.RadiusActivation)
    .Where(ba => ba.Id == id)
    .FirstOrDefaultAsync();

var transactions = await _context.Transactions
    .Where(t => t.BillingActivationId == id)
    .ToListAsync();
```

### Get All Radius Activations for a Billing Event
```csharp
var radiusActivations = await _context.RadiusActivations
    .Where(ra => ra.BillingActivationId == billingActivationId)
    .ToListAsync();
```

## Benefits of This Architecture

### 1. **Financial Integrity**
- Single master record for all financial operations
- Complete audit trail through BillingActivation reference
- No orphaned transactions

### 2. **Scalability**
- Supports multiple RadiusActivations per billing event
- Can handle complex activation scenarios:
  - Bundle activations (main + addons)
  - Multi-service activations
  - Family plan activations

### 3. **Reporting & Analytics**
- Simple aggregation queries on BillingActivations
- Easy revenue tracking
- Cashback analysis
- Payment method distribution

### 4. **Compliance**
- Complete audit trail
- Financial reconciliation
- Transaction traceability
- User action tracking

### 5. **Data Consistency**
- Transaction-wrapped operations
- Rollback on failure
- No partial activations

## Future Enhancements

### Multi-Service Activations
When a billing profile includes add-ons or multiple services:
```
BillingActivation (id: 1, amount: $100)
  ├─ RadiusActivation (id: 1, main service, $70)
  ├─ RadiusActivation (id: 2, addon 1, $15)
  └─ RadiusActivation (id: 3, addon 2, $15)
  
All transactions reference BillingActivationId = 1
```

### Family Plans
One payment for multiple users:
```
BillingActivation (id: 1, amount: $200, payer: user1)
  ├─ RadiusActivation (id: 1, user: user1, $80)
  ├─ RadiusActivation (id: 2, user: user2, $60)
  └─ RadiusActivation (id: 3, user: user3, $60)
```

## Migration Notes

### Backward Compatibility
- `Transaction.ActivationId` is maintained for backward compatibility
- Both ActivationId and BillingActivationId are set during activation
- Legacy code can continue using ActivationId temporarily
- New code should use BillingActivationId exclusively

### Data Migration
For existing data, run:
```sql
-- Set BillingActivationId based on existing ActivationId
UPDATE "Transactions" t
SET "BillingActivationId" = (
    SELECT ra."BillingActivationId"
    FROM "RadiusActivations" ra
    WHERE ra."Id" = t."ActivationId"
)
WHERE t."ActivationId" IS NOT NULL
AND t."BillingActivationId" IS NULL;
```

## API Changes

### BillingActivations Endpoints
- `GET /api/billingactivations` - List with filters
- `GET /api/billingactivations/{id}` - Get single record with full details
- `GET /api/billingactivations/billing-profile/{id}` - By billing profile
- `GET /api/billingactivations/stats` - Revenue and cashback statistics

### Transactions Query
New filter option: `?billingActivationId={id}` to get all transactions for a billing event.

## Conclusion

This enterprise-grade architecture provides a solid foundation for:
- Financial accuracy and audit compliance
- Scalable multi-service activations
- Complete transaction traceability
- Future business model flexibility

The hierarchical master-detail pattern with proper foreign key relationships ensures data integrity while maintaining flexibility for future enhancements.
