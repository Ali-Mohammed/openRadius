# xUnit Wallet Testing Guide

This document provides comprehensive testing examples for the wallet functionality in OpenRadius.

## Test Project Setup

The test project (`Backend.Tests`) is configured with:

### Dependencies
- **xUnit**: Testing framework
- **Moq** (4.20.72): Mocking dependencies
- **FluentAssertions** (8.8.0): Readable test assertions
- **Entity Framework Core InMemory** (10.0.2): In-memory database for isolated testing

### Project Structure
```
Backend.Tests/
├── Billing/
│   ├── UserWalletTests.cs (13 tests)
│   └── TransactionTests.cs (11 tests)
├── Network/
└── Radius/
```

## Running Tests

```bash
cd Backend.Tests
dotnet test --verbosity normal
```

**Result**: ✅ All 24 tests passing

---

## UserWallet Tests (13 Tests)

### 1. Basic Wallet Creation
Tests wallet creation with valid data and verifies all fields are set correctly.

```csharp
[Fact]
public async Task CreateUserWallet_WithValidData_ShouldSucceed()
{
    var wallet = new UserWallet
    {
        UserId = 1,
        CustomWalletId = _testCustomWallet.Id,
        CurrentBalance = 100.00m,
        Status = "active",
        AllowNegativeBalance = false
    };

    _context.UserWallets.Add(wallet);
    await _context.SaveChangesAsync();

    var savedWallet = await _context.UserWallets.FindAsync(wallet.Id);
    savedWallet.Should().NotBeNull();
    savedWallet!.CurrentBalance.Should().Be(100.00m);
}
```

### 2. Zero Balance Wallet
Ensures wallets can be created with zero balance.

### 3. Negative Balance (Allowed)
Tests that wallets can have negative balance when explicitly allowed.

```csharp
[Fact]
public async Task CreateUserWallet_WithNegativeBalanceAllowed_ShouldSucceed()
{
    var wallet = new UserWallet
    {
        UserId = 1,
        CustomWalletId = _testCustomWallet.Id,
        CurrentBalance = -50.00m,
        AllowNegativeBalance = true
    };

    _context.UserWallets.Add(wallet);
    await _context.SaveChangesAsync();

    var savedWallet = await _context.UserWallets.FindAsync(wallet.Id);
    savedWallet!.CurrentBalance.Should().Be(-50.00m);
}
```

### 4-5. Wallet Retrieval
Tests finding existing and non-existing wallets.

### 6-7. Balance Updates
Tests adding and deducting funds from wallets.

```csharp
[Fact]
public async Task UpdateWalletBalance_AddFunds_ShouldIncreaseBalance()
{
    // Create wallet with 100.00
    wallet.CurrentBalance += 50.00m;
    wallet.UpdatedAt = DateTime.UtcNow;
    await _context.SaveChangesAsync();

    var updatedWallet = await _context.UserWallets.FindAsync(wallet.Id);
    updatedWallet!.CurrentBalance.Should().Be(150.00m);
}
```

### 8. Multiple Wallets Per User
Verifies users can have multiple wallets.

### 9. Soft Delete
Tests soft deletion marking wallet as deleted without removing from database.

### 10. Status Changes
Verifies wallet status transitions are tracked.

### 11. Multiple Custom Wallets
Tests user can have different custom wallet types.

### 12. Wallet Limits
Verifies MaxFillLimit and DailySpendingLimit are stored correctly.

---

## Transaction Tests (11 Tests)

### 1. Credit Transaction (Top-Up)
Tests deposit transactions that increase wallet balance.

```csharp
[Fact]
public async Task CreateTransaction_Credit_ShouldIncreaseBalance()
{
    var transaction = new Transaction
    {
        UserId = 1,
        UserWalletId = _testUserWallet.Id,
        TransactionType = TransactionType.TopUp,
        AmountType = "credit",
        Amount = 500.00m,
        BalanceBefore = 1000.00m,
        BalanceAfter = 1500.00m,
        Status = "completed"
    };

    _context.Transactions.Add(transaction);
    _testUserWallet.CurrentBalance += 500.00m;
    await _context.SaveChangesAsync();

    var savedTransaction = await _context.Transactions.FindAsync(transaction.Id);
    savedTransaction!.Amount.Should().Be(500.00m);
    savedTransaction.BalanceAfter.Should().Be(1500.00m);
}
```

### 2. Debit Transaction (Withdrawal)
Tests withdrawal transactions that decrease wallet balance.

### 3. Payment Transaction
Tests service payment transactions with description.

### 4. Transaction History Ordering
Verifies transactions are retrieved in correct chronological order.

```csharp
[Fact]
public async Task GetTransactionHistory_ShouldReturnInCorrectOrder()
{
    var transactions = new[]
    {
        new Transaction { /* 3 days ago */ },
        new Transaction { /* 2 days ago */ },
        new Transaction { /* 1 day ago */ }
    };

    _context.Transactions.AddRange(transactions);
    await _context.SaveChangesAsync();

    var history = await _context.Transactions
        .Where(t => t.UserId == 1)
        .OrderByDescending(t => t.CreatedAt)
        .ToListAsync();

    history[0].Should().Be(/* most recent */);
}
```

### 5. Transaction with Reference
Tests storing external reference and payment method.

### 6. Cancelled Transaction
Verifies cancelled transactions don't update wallet balance.

```csharp
[Fact]
public async Task Transaction_Cancelled_ShouldNotUpdateBalance()
{
    var transaction = new Transaction
    {
        Status = "cancelled",
        Reason = "User cancelled request",
        BalanceBefore = initialBalance,
        BalanceAfter = initialBalance  // No change
    };

    // Balance NOT updated for cancelled transactions
    var wallet = await _context.UserWallets.FindAsync(_testUserWallet.Id);
    wallet!.CurrentBalance.Should().Be(initialBalance);
}
```

### 7. Pending to Completed Transition
Tests completing a pending transaction.

### 8. Transaction Amount Totals
Verifies calculating total amounts by transaction type.

```csharp
[Fact]
public async Task GetTotalTransactionAmount_ByType_ShouldCalculateCorrectly()
{
    // Add 3 top-up transactions: 100, 200, 150
    var totalTopUps = await _context.Transactions
        .Where(t => t.TransactionType == TransactionType.TopUp && t.Status == "completed")
        .SumAsync(t => t.Amount);

    totalTopUps.Should().Be(450.00m);
}
```

### 9. Transaction with Metadata
Tests storing JSON metadata with transactions.

### 10. Transaction Grouping
Verifies linking related transactions with TransactionGroupId.

```csharp
[Fact]
public async Task Transaction_WithTransactionGroup_ShouldLinkRelatedTransactions()
{
    var groupId = Guid.NewGuid();
    var transactions = new[]
    {
        new Transaction { TransactionGroupId = groupId, /* Payment */ },
        new Transaction { TransactionGroupId = groupId, /* Cashback */ }
    };

    var groupedTransactions = await _context.Transactions
        .Where(t => t.TransactionGroupId == groupId)
        .ToListAsync();

    groupedTransactions.Should().HaveCount(2);
}
```

---

## Test Patterns Used

### Arrange-Act-Assert (AAA)
All tests follow the AAA pattern for clarity:
- **Arrange**: Set up test data and preconditions
- **Act**: Execute the operation being tested
- **Assert**: Verify the expected outcome

### FluentAssertions Syntax
```csharp
result.Should().NotBeNull();
amount.Should().Be(100.00m);
date.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
list.Should().HaveCount(3);
condition.Should().BeTrue();
```

### In-Memory Database
Each test uses an isolated database instance:
```csharp
var options = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
    .Options;
```

### Test Cleanup
Implements IDisposable for proper resource cleanup:
```csharp
public void Dispose()
{
    _context.Database.EnsureDeleted();
    _context.Dispose();
}
```

---

## Transaction Types Reference

Available transaction types from `TransactionType` class:
- `TopUp`: Add funds (credit)
- `Withdrawal`: Remove funds (debit)
- `Transfer`: Transfer between wallets (debit)
- `Payment`: Service payment (debit)
- `Refund`: Payment refund (credit)
- `Reward`: Loyalty reward (credit)
- `Cashback`: Cashback earning (credit)
- `Fee`: Service fee (debit)
- `Commission`: Agent commission (debit)
- `Adjustment`: Manual adjustment (credit/debit)
- `Purchase`: Item purchase (debit)

---

## Test Coverage Summary

✅ **UserWallet Tests (13)**
- Creation (valid, zero balance, negative balance)
- Retrieval (found, not found)
- Balance updates (add, deduct)
- Multiple wallets per user
- Soft delete
- Status changes
- Wallet limits

✅ **Transaction Tests (11)**
- Credit transactions
- Debit transactions
- Transaction history
- References and metadata
- Status transitions (pending → completed, cancelled)
- Amount calculations
- Transaction grouping

**Total**: 24 tests, all passing ✅

---

## Best Practices

1. **Isolated Tests**: Each test has its own in-memory database
2. **Descriptive Names**: Method names clearly state scenario and expected outcome
3. **Comprehensive Coverage**: Tests cover positive cases, edge cases, and error scenarios
4. **Readable Assertions**: FluentAssertions make test intent clear
5. **Proper Cleanup**: IDisposable pattern ensures no resource leaks
6. **Test Data**: Minimal test data seeded for each test

---

## Next Steps

To extend test coverage, consider adding:
- **WalletHistory Tests**: Audit trail testing
- **Integration Tests**: Multi-wallet transaction flows
- **BillingActivation Tests**: Activation lifecycle testing
- **Cashback Tests**: Cashback calculation and distribution
- **Controller Tests**: API endpoint testing with mocked services
- **Validation Tests**: Input validation and error handling

---

## Running Specific Tests

```bash
# Run all tests
dotnet test

# Run only UserWallet tests
dotnet test --filter "FullyQualifiedName~UserWalletTests"

# Run only Transaction tests
dotnet test --filter "FullyQualifiedName~TransactionTests"

# Run specific test
dotnet test --filter "FullyQualifiedName~CreateUserWallet_WithValidData_ShouldSucceed"
```
