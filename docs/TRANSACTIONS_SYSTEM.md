# Transactions System

## Overview

The Transactions system provides comprehensive transaction logging and management for both Custom Wallets and User Wallets. It features automatic balance tracking with before/after amounts and a sophisticated reversal system that maintains complete audit trails when transactions are deleted.

## Key Features

### 1. **Transaction Logging**
- Logs all wallet transactions with complete details
- Tracks balance before and after each transaction
- Supports both Custom Wallets and User Wallets
- Records user information, timestamps, and audit data

### 2. **Transaction Types**
10 predefined transaction types with credit/debit classification:
- **TopUp** (Credit) - Adding funds to wallet
- **Withdrawal** (Debit) - Removing funds from wallet
- **Transfer** (Mixed) - Moving funds between wallets
- **Adjustment** (Mixed) - Manual balance corrections
- **Purchase** (Debit) - Buying products/services
- **Refund** (Credit) - Returning funds for purchases
- **Payment** (Debit) - Making payments
- **Reward** (Credit) - Awarding bonuses/rewards
- **Fee** (Debit) - Service fees
- **Commission** (Credit) - Commission earnings

### 3. **Automatic Balance Reversal**
When a transaction is deleted:
1. A reversal transaction is created (opposite credit/debit)
2. Wallet balance is automatically restored
3. Original transaction marked as `reversed` status
4. Original transaction soft-deleted for audit trail
5. Reversal linked to original via `RelatedTransactionId`

### 4. **Status Tracking**
- **completed** - Successfully processed transaction
- **pending** - Awaiting processing
- **cancelled** - Cancelled before completion
- **reversed** - Transaction has been reversed

### 5. **Comprehensive Filtering**
Filter transactions by:
- Wallet type (Custom/User)
- Specific wallet
- User
- Transaction type
- Status
- Date range
- Pagination support

### 6. **Statistics Dashboard**
Real-time stats including:
- Total transactions count
- Total credit amount
- Total debit amount
- Net amount (credit - debit)
- Breakdown by transaction type

## Backend Implementation

### Models

#### Transaction Model
Located: `Backend/Models/Transaction.cs`

```csharp
public class Transaction
{
    public int Id { get; set; }
    public string WalletType { get; set; } // "custom" or "user"
    public int? CustomWalletId { get; set; }
    public int? UserWalletId { get; set; }
    public string? UserId { get; set; }
    public string TransactionType { get; set; } // From TransactionType constants
    public bool IsCredit { get; set; } // true = credit, false = debit
    public decimal Amount { get; set; }
    public string Status { get; set; } // completed, pending, cancelled, reversed
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? Description { get; set; }
    public string? Reason { get; set; }
    public string? Reference { get; set; }
    public string? PaymentMethod { get; set; }
    public int? RelatedTransactionId { get; set; } // Links to original when reversed
    public string? Metadata { get; set; } // JSON for additional data
    
    // Audit fields
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    
    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Navigation properties
    public virtual CustomWallet? CustomWallet { get; set; }
    public virtual UserWallet? UserWallet { get; set; }
    public virtual Transaction? RelatedTransaction { get; set; }
}
```

#### TransactionType Constants
Located: `Backend/Models/TransactionType.cs`

```csharp
public static class TransactionType
{
    public const string TopUp = "topup";
    public const string Withdrawal = "withdrawal";
    public const string Transfer = "transfer";
    public const string Adjustment = "adjustment";
    public const string Purchase = "purchase";
    public const string Refund = "refund";
    public const string Payment = "payment";
    public const string Reward = "reward";
    public const string Fee = "fee";
    public const string Commission = "commission";
    
    public static bool IsCredit(string type) { /* ... */ }
    public static bool IsDebit(string type) { /* ... */ }
    public static string GetDisplayName(string type) { /* ... */ }
}
```

### API Endpoints

#### TransactionController
Located: `Backend/Controllers/TransactionController.cs`

**GET /api/transactions**
- Returns paginated list of transactions
- Query parameters: walletType, customWalletId, userWalletId, userId, transactionType, status, startDate, endDate, page, pageSize
- Joins with users from MasterDbContext for user details
- Returns: `{ data: Transaction[], currentPage, pageSize, totalCount, totalPages }`

**GET /api/transactions/{id}**
- Returns single transaction with user details
- Returns: `Transaction`

**POST /api/transactions**
- Creates new transaction
- Validates wallet existence and balance constraints
- Updates wallet balance (credit adds, debit subtracts)
- Creates WalletHistory record
- Sets transaction status to 'completed'
- Returns: `Transaction`

**DELETE /api/transactions/{id}**
- Reverses transaction and restores balance
- Creates reversal transaction (opposite IsCredit)
- Marks original as Status='reversed' and soft-deletes it
- Creates WalletHistory for reversal
- Returns: `{ transactionId, reversalTransactionId, newBalance }`

**GET /api/transactions/stats**
- Returns transaction statistics
- Query parameters: walletType, customWalletId, userWalletId, startDate, endDate
- Returns: `{ totalTransactions, totalCredit, totalDebit, netAmount, byType: [] }`

### Database Schema

#### Transactions Table
```sql
CREATE TABLE "Transactions" (
    "Id" SERIAL PRIMARY KEY,
    "WalletType" VARCHAR(50) NOT NULL,
    "CustomWalletId" INT NULL,
    "UserWalletId" INT NULL,
    "UserId" VARCHAR(255) NULL,
    "TransactionType" VARCHAR(50) NOT NULL,
    "IsCredit" BOOLEAN NOT NULL,
    "Amount" DECIMAL(18,2) NOT NULL,
    "Status" VARCHAR(50) NOT NULL,
    "BalanceBefore" DECIMAL(18,2) NOT NULL,
    "BalanceAfter" DECIMAL(18,2) NOT NULL,
    "Description" TEXT NULL,
    "Reason" TEXT NULL,
    "Reference" VARCHAR(255) NULL,
    "PaymentMethod" VARCHAR(100) NULL,
    "RelatedTransactionId" INT NULL,
    "Metadata" TEXT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "CreatedBy" VARCHAR(255) NULL,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "DeletedAt" TIMESTAMP NULL,
    "DeletedBy" VARCHAR(255) NULL,
    
    FOREIGN KEY ("CustomWalletId") REFERENCES "CustomWallets"("Id") ON DELETE RESTRICT,
    FOREIGN KEY ("UserWalletId") REFERENCES "UserWallets"("Id") ON DELETE RESTRICT,
    FOREIGN KEY ("RelatedTransactionId") REFERENCES "Transactions"("Id") ON DELETE RESTRICT
);

-- Indexes for performance
CREATE INDEX "IX_Transactions_WalletType" ON "Transactions"("WalletType");
CREATE INDEX "IX_Transactions_CustomWalletId" ON "Transactions"("CustomWalletId");
CREATE INDEX "IX_Transactions_UserWalletId" ON "Transactions"("UserWalletId");
CREATE INDEX "IX_Transactions_UserId" ON "Transactions"("UserId");
CREATE INDEX "IX_Transactions_TransactionType" ON "Transactions"("TransactionType");
CREATE INDEX "IX_Transactions_Status" ON "Transactions"("Status");
CREATE INDEX "IX_Transactions_CreatedAt" ON "Transactions"("CreatedAt");
CREATE INDEX "IX_Transactions_RelatedTransactionId" ON "Transactions"("RelatedTransactionId");
```

## Frontend Implementation

### API Client
Located: `Frontend/src/api/transactions.ts`

```typescript
interface Transaction {
  id: number
  walletType: 'custom' | 'user'
  customWalletId?: number
  customWalletName?: string
  userWalletId?: number
  userId?: string
  userEmail?: string
  userName?: string
  transactionType: TransactionType
  isCredit: boolean
  amount: number
  status: 'completed' | 'pending' | 'cancelled' | 'reversed'
  balanceBefore: number
  balanceAfter: number
  description?: string
  reason?: string
  reference?: string
  paymentMethod?: string
  relatedTransactionId?: number
  createdAt: string
  createdBy?: string
}

transactionApi.getAll(filters?: TransactionFilters): Promise<TransactionResponse>
transactionApi.getById(id: number): Promise<Transaction>
transactionApi.create(transaction: CreateTransactionRequest): Promise<Transaction>
transactionApi.delete(id: number): Promise<void>
transactionApi.getStats(filters?): Promise<TransactionStats>
```

### Transactions Page
Located: `Frontend/src/pages/Transactions.tsx`

Features:
- **Stats Dashboard**: Cards showing total transactions, credit, debit, and net amount
- **Filters**: Wallet type, transaction type, status, date range
- **Table**: Displays all transactions with color-coded badges
- **Create Dialog**: Form to create new transactions
- **Delete/Reversal**: Confirms and reverses transactions
- **Pagination**: Navigate through large transaction sets
- **Real-time Updates**: Uses TanStack Query for automatic cache invalidation

### Transaction Type Constants
Located: `Frontend/src/constants/transactionTypes.ts`

```typescript
export const TRANSACTION_TYPES = {
  TOP_UP: 'topup',
  WITHDRAWAL: 'withdrawal',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment',
  PURCHASE: 'purchase',
  REFUND: 'refund',
  PAYMENT: 'payment',
  REWARD: 'reward',
  FEE: 'fee',
  COMMISSION: 'commission',
}

export const TRANSACTION_TYPE_INFO = {
  [TRANSACTION_TYPES.TOP_UP]: {
    label: 'Top Up',
    isCredit: true,
    color: 'text-green-600',
  },
  // ... other types
}

// Helper functions
isCredit(type: TransactionType): boolean
isDebit(type: TransactionType): boolean
getTransactionTypeLabel(type: TransactionType): string
getTransactionTypeColor(type: TransactionType): string
```

### Navigation
- **Route**: `/billing/transactions`
- **Sidebar**: Under "Billing" section
- **Icon**: Receipt
- **i18n Keys**: 
  - English: `navigation.transactions` → "Transactions"
  - Arabic: `navigation.transactions` → "المعاملات"

## Usage Examples

### Creating a Transaction
```typescript
await transactionApi.create({
  walletType: 'custom',
  customWalletId: 1,
  transactionType: TRANSACTION_TYPES.TOP_UP,
  amount: 100.00,
  description: 'Monthly top-up',
  paymentMethod: 'Bank Transfer',
  reference: 'TXN-12345'
})
```

### Filtering Transactions
```typescript
await transactionApi.getAll({
  walletType: 'user',
  transactionType: TRANSACTION_TYPES.PURCHASE,
  status: 'completed',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  page: 1,
  pageSize: 20
})
```

### Reversing a Transaction
```typescript
// Simply delete the transaction - reversal is automatic
await transactionApi.delete(123)

// Backend will:
// 1. Create reversal transaction with opposite IsCredit
// 2. Restore wallet balance
// 3. Mark original as reversed and soft-delete it
// 4. Link reversal to original via RelatedTransactionId
```

### Getting Statistics
```typescript
const stats = await transactionApi.getStats({
  walletType: 'custom',
  startDate: '2024-01-01',
  endDate: '2024-01-31'
})

// Returns:
// {
//   totalTransactions: 150,
//   totalCredit: 5000.00,
//   totalDebit: 3000.00,
//   netAmount: 2000.00,
//   byType: [
//     { transactionType: 'topup', totalAmount: 3000.00, count: 50 },
//     // ...
//   ]
// }
```

## Double-Entry Bookkeeping

The system uses double-entry recording:
1. **Transaction Table**: Records the transaction details
2. **WalletHistory Table**: Records the balance change

When a transaction is created:
```csharp
// 1. Create transaction record
var transaction = new Transaction { /* ... */ };
_context.Transactions.Add(transaction);

// 2. Update wallet balance
wallet.CurrentBalance += transaction.IsCredit ? transaction.Amount : -transaction.Amount;

// 3. Create wallet history
var history = new WalletHistory { /* ... */ };
_context.WalletHistory.Add(history);

await _context.SaveChangesAsync();
```

When a transaction is reversed:
```csharp
// 1. Reverse wallet balance
wallet.CurrentBalance += transaction.IsCredit ? -transaction.Amount : transaction.Amount;

// 2. Create reversal transaction
var reversal = new Transaction {
    IsCredit = !transaction.IsCredit, // Opposite
    RelatedTransactionId = transaction.Id,
    // ...
};

// 3. Mark original as reversed and soft-delete
transaction.Status = "reversed";
transaction.IsDeleted = true;
transaction.DeletedAt = DateTime.UtcNow;

// 4. Create wallet history for reversal
var history = new WalletHistory { /* ... */ };

await _context.SaveChangesAsync();
```

## Security & Validation

### Backend Validations
1. **Wallet Existence**: Validates wallet exists before creating transaction
2. **Balance Constraints**: Checks AllowNegativeBalance flag on wallet
3. **Amount Validation**: Ensures amount > 0
4. **Status Validation**: Only 'completed' transactions can be reversed
5. **Soft Delete Check**: Prevents reversing already deleted transactions

### Audit Trail
All transactions include:
- `CreatedAt`: When transaction was created
- `CreatedBy`: User who created the transaction
- `DeletedAt`: When transaction was reversed
- `DeletedBy`: User who reversed the transaction
- `RelatedTransactionId`: Link to reversal transaction

### Data Integrity
- Foreign key constraints prevent orphaned records
- Soft delete preserves historical data
- Transaction status tracks lifecycle
- Reversal link maintains audit trail

## Performance Considerations

### Indexes
8 indexes on Transactions table for optimal query performance:
- `WalletType` - Fast filtering by wallet type
- `CustomWalletId` - Joining with custom wallets
- `UserWalletId` - Joining with user wallets
- `UserId` - User-specific queries
- `TransactionType` - Filtering by type
- `Status` - Filtering by status
- `CreatedAt` - Date range queries and sorting
- `RelatedTransactionId` - Finding reversals

### Query Optimization
- Pagination to limit result sets
- Selective joins (only when user details needed)
- Indexed filters for fast lookups
- Soft delete filter applied globally via EF Core

## Testing Checklist

### Backend Tests
- [ ] Create transaction updates wallet balance correctly
- [ ] Create transaction with invalid wallet fails
- [ ] Create transaction with negative balance on non-negative wallet fails
- [ ] Delete transaction creates reversal
- [ ] Delete transaction restores balance
- [ ] Delete transaction marks original as reversed
- [ ] Filters work correctly
- [ ] Pagination works correctly
- [ ] Stats calculation accurate

### Frontend Tests
- [ ] Transactions page loads and displays data
- [ ] Filters update results
- [ ] Create dialog validates inputs
- [ ] Create transaction succeeds
- [ ] Delete confirmation shows
- [ ] Delete reverses transaction
- [ ] Stats cards display correctly
- [ ] Pagination controls work
- [ ] Table sorting works

## Migration

Migration: `20260107204424_AddTransactionsTable`
Applied: Yes (2025-01-07)

To rollback:
```bash
cd Backend
dotnet ef migrations remove --context ApplicationDbContext
```

To reapply:
```bash
cd Backend
dotnet ef database update --context ApplicationDbContext
```

## Related Features

- **Custom Wallets**: Template-based wallets for different purposes
- **User Wallets**: Individual user wallet instances
- **Top-Up**: Add balance to wallets (creates Transaction + WalletHistory)
- **Wallet History**: Audit trail of all balance changes
- **Transaction Types**: Centralized constants for type classification

## Future Enhancements

1. **Bulk Operations**: Create/reverse multiple transactions at once
2. **Scheduled Transactions**: Recurring payments/top-ups
3. **Transaction Templates**: Save common transaction patterns
4. **Export**: Export transactions to CSV/Excel
5. **Advanced Reporting**: Charts and graphs for transaction analysis
6. **Approval Workflow**: Multi-step approval for large transactions
7. **Transaction Notes**: Add comments/notes to transactions
8. **Attachments**: Upload receipts/invoices
9. **Email Notifications**: Notify users of transactions
10. **Webhook Integration**: External system notifications
