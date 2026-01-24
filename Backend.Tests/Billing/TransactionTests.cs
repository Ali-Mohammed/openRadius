using System;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests.Billing;

/// <summary>
/// Unit tests for Transaction functionality
/// Tests cover transaction creation, balance updates, and transaction history
/// </summary>
public class TransactionTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly CustomWallet _testCustomWallet;
    private readonly UserWallet _testUserWallet;

    public TransactionTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(options);

        // Seed test data
        _testCustomWallet = new CustomWallet
        {
            Id = 1,
            Name = "Test Wallet",
            Icon = "wallet",
            Color = "#FF0000",
            AllowNegativeBalance = false,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        };

        _testUserWallet = new UserWallet
        {
            Id = 1,
            UserId = 1, // Test user ID
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 1000.00m,
            Status = "active",
            AllowNegativeBalance = false
        };

        _context.CustomWallets.Add(_testCustomWallet);
        _context.UserWallets.Add(_testUserWallet);
        _context.SaveChanges();
    }

    [Fact]
    public async Task CreateTransaction_Credit_ShouldIncreaseBalance()
    {
        // Arrange
        var initialBalance = _testUserWallet.CurrentBalance;
        var creditAmount = 500.00m;

        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            CustomWalletId = _testCustomWallet.Id,
            TransactionType = TransactionType.TopUp,
            AmountType = "credit",
            Amount = creditAmount,
            WalletType = "user",
            BalanceBefore = initialBalance,
            BalanceAfter = initialBalance + creditAmount,
            Status = "completed",
            CreatedAt = DateTime.UtcNow
        };

        // Act
        _context.Transactions.Add(transaction);
        _testUserWallet.CurrentBalance += creditAmount;
        await _context.SaveChangesAsync();

        // Assert
        var savedTransaction = await _context.Transactions.FindAsync(transaction.Id);
        savedTransaction.Should().NotBeNull();
        savedTransaction!.Amount.Should().Be(500.00m);
        savedTransaction.BalanceBefore.Should().Be(1000.00m);
        savedTransaction.BalanceAfter.Should().Be(1500.00m);
        savedTransaction.Status.Should().Be("completed");

        var updatedWallet = await _context.UserWallets.FindAsync(_testUserWallet.Id);
        updatedWallet!.CurrentBalance.Should().Be(1500.00m);
    }

    [Fact]
    public async Task CreateTransaction_Debit_ShouldDecreaseBalance()
    {
        // Arrange
        var initialBalance = _testUserWallet.CurrentBalance;
        var debitAmount = 300.00m;

        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            CustomWalletId = _testCustomWallet.Id,
            TransactionType = TransactionType.Withdrawal,
            AmountType = "debit",
            Amount = debitAmount,
            WalletType = "user",
            BalanceBefore = initialBalance,
            BalanceAfter = initialBalance - debitAmount,
            Status = "completed",
            CreatedAt = DateTime.UtcNow
        };

        // Act
        _context.Transactions.Add(transaction);
        _testUserWallet.CurrentBalance -= debitAmount;
        await _context.SaveChangesAsync();

        // Assert
        var savedTransaction = await _context.Transactions.FindAsync(transaction.Id);
        savedTransaction.Should().NotBeNull();
        savedTransaction!.Amount.Should().Be(300.00m);
        savedTransaction.BalanceBefore.Should().Be(1000.00m);
        savedTransaction.BalanceAfter.Should().Be(700.00m);

        var updatedWallet = await _context.UserWallets.FindAsync(_testUserWallet.Id);
        updatedWallet!.CurrentBalance.Should().Be(700.00m);
    }

    [Fact]
    public async Task CreateTransaction_Payment_ShouldUpdateBalanceCorrectly()
    {
        // Arrange
        var initialBalance = _testUserWallet.CurrentBalance;
        var activationAmount = 250.00m;

        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            CustomWalletId = _testCustomWallet.Id,
            TransactionType = TransactionType.Payment,
            AmountType = "debit",
            Amount = activationAmount,
            WalletType = "user",
            BalanceBefore = initialBalance,
            BalanceAfter = initialBalance - activationAmount,
            Status = "completed",
            Description = "Service activation",
            CreatedAt = DateTime.UtcNow
        };

        // Act
        _context.Transactions.Add(transaction);
        _testUserWallet.CurrentBalance -= activationAmount;
        await _context.SaveChangesAsync();

        // Assert
        var savedTransaction = await _context.Transactions.FindAsync(transaction.Id);
        savedTransaction.Should().NotBeNull();
        savedTransaction!.TransactionType.Should().Be(TransactionType.Payment);
        savedTransaction.Description.Should().Be("Service activation");

        var updatedWallet = await _context.UserWallets.FindAsync(_testUserWallet.Id);
        updatedWallet!.CurrentBalance.Should().Be(750.00m);
    }

    [Fact]
    public async Task GetTransactionHistory_ShouldReturnInCorrectOrder()
    {
        // Arrange
        var transactions = new[]
        {
            new Transaction
            {
                UserId = 1,
                UserWalletId = _testUserWallet.Id,
                Amount = 100.00m,
                TransactionType = TransactionType.TopUp,
                AmountType = "credit",
                WalletType = "user",
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            },
            new Transaction
            {
                UserId = 1,
                UserWalletId = _testUserWallet.Id,
                Amount = 50.00m,
                TransactionType = TransactionType.Withdrawal,
                AmountType = "debit",
                WalletType = "user",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new Transaction
            {
                UserId = 1,
                UserWalletId = _testUserWallet.Id,
                Amount = 75.00m,
                TransactionType = TransactionType.Payment,
                AmountType = "debit",
                WalletType = "user",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            }
        };

        _context.Transactions.AddRange(transactions);
        await _context.SaveChangesAsync();

        // Act
        var history = await _context.Transactions
            .Where(t => t.UserId == 1)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        // Assert
        history.Should().HaveCount(3);
        history[0].Amount.Should().Be(75.00m); // Most recent
        history[1].Amount.Should().Be(50.00m);
        history[2].Amount.Should().Be(100.00m); // Oldest
    }

    [Fact]
    public async Task Transaction_WithReference_ShouldStoreCorrectly()
    {
        // Arrange
        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            Amount = 100.00m,
            TransactionType = TransactionType.TopUp,
            AmountType = "credit",
            WalletType = "user",
            Reference = "REF-12345",
            PaymentMethod = "bank_transfer",
            Status = "completed",
            CreatedAt = DateTime.UtcNow
        };

        // Act
        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync();

        // Assert
        var savedTransaction = await _context.Transactions
            .FirstOrDefaultAsync(t => t.Reference == "REF-12345");
        
        savedTransaction.Should().NotBeNull();
        savedTransaction!.PaymentMethod.Should().Be("bank_transfer");
    }

    [Fact]
    public async Task Transaction_Cancelled_ShouldNotUpdateBalance()
    {
        // Arrange
        var initialBalance = _testUserWallet.CurrentBalance;
        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            Amount = 100.00m,
            TransactionType = TransactionType.TopUp,
            AmountType = "credit",
            WalletType = "user",
            BalanceBefore = initialBalance,
            BalanceAfter = initialBalance, // Balance unchanged for cancelled transaction
            Status = "cancelled",
            Reason = "User cancelled request",
            CreatedAt = DateTime.UtcNow
        };

        // Act
        _context.Transactions.Add(transaction);
        // Note: Balance should NOT be updated for cancelled transactions
        await _context.SaveChangesAsync();

        // Assert
        var savedTransaction = await _context.Transactions.FindAsync(transaction.Id);
        savedTransaction.Should().NotBeNull();
        savedTransaction!.Status.Should().Be("cancelled");
        savedTransaction.Reason.Should().Be("User cancelled request");

        var wallet = await _context.UserWallets.FindAsync(_testUserWallet.Id);
        wallet!.CurrentBalance.Should().Be(initialBalance); // Balance unchanged
    }

    [Fact]
    public async Task Transaction_Pending_CanBeCompleted()
    {
        // Arrange
        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            Amount = 100.00m,
            TransactionType = TransactionType.TopUp,
            AmountType = "credit",
            WalletType = "user",
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync();

        // Act - Complete the transaction
        transaction.Status = "completed";
        transaction.UpdatedAt = DateTime.UtcNow;
        transaction.BalanceBefore = _testUserWallet.CurrentBalance;
        transaction.BalanceAfter = _testUserWallet.CurrentBalance + transaction.Amount;
        
        _testUserWallet.CurrentBalance += transaction.Amount;
        await _context.SaveChangesAsync();

        // Assert
        var completedTransaction = await _context.Transactions.FindAsync(transaction.Id);
        completedTransaction.Should().NotBeNull();
        completedTransaction!.Status.Should().Be("completed");
        completedTransaction.UpdatedAt.Should().NotBeNull();
        completedTransaction.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task GetTotalTransactionAmount_ByType_ShouldCalculateCorrectly()
    {
        // Arrange
        var topUps = new[]
        {
            new Transaction { UserId = 1, Amount = 100.00m, TransactionType = TransactionType.TopUp, AmountType = "credit", WalletType = "user", Status = "completed", CreatedAt = DateTime.UtcNow },
            new Transaction { UserId = 1, Amount = 200.00m, TransactionType = TransactionType.TopUp, AmountType = "credit", WalletType = "user", Status = "completed", CreatedAt = DateTime.UtcNow },
            new Transaction { UserId = 1, Amount = 150.00m, TransactionType = TransactionType.TopUp, AmountType = "credit", WalletType = "user", Status = "completed", CreatedAt = DateTime.UtcNow }
        };

        _context.Transactions.AddRange(topUps);
        await _context.SaveChangesAsync();

        // Act
        var totalTopUps = await _context.Transactions
            .Where(t => t.UserId == 1 && t.TransactionType == TransactionType.TopUp && t.Status == "completed")
            .SumAsync(t => t.Amount);

        // Assert
        totalTopUps.Should().Be(450.00m);
    }

    [Fact]
    public async Task Transaction_WithMetadata_ShouldStoreAndRetrieve()
    {
        // Arrange
        var metadata = "{\"source\":\"mobile\",\"device\":\"iPhone\",\"version\":\"1.0\"}";
        var transaction = new Transaction
        {
            UserId = 1,
            UserWalletId = _testUserWallet.Id,
            Amount = 100.00m,
            TransactionType = TransactionType.Payment,
            AmountType = "debit",
            WalletType = "user",
            Metadata = metadata,
            Status = "completed",
            CreatedAt = DateTime.UtcNow
        };

        // Act
        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync();

        // Assert
        var savedTransaction = await _context.Transactions.FindAsync(transaction.Id);
        savedTransaction.Should().NotBeNull();
        savedTransaction!.Metadata.Should().Be(metadata);
    }

    [Fact]
    public async Task Transaction_WithTransactionGroup_ShouldLinkRelatedTransactions()
    {
        // Arrange
        var groupId = Guid.NewGuid();
        var transactions = new[]
        {
            new Transaction
            {
                UserId = 1,
                TransactionType = TransactionType.Payment,
                Amount = 100.00m,
                AmountType = "debit",
                WalletType = "user",
                TransactionGroupId = groupId,
                Status = "completed"
            },
            new Transaction
            {
                UserId = 1,
                TransactionType = TransactionType.Cashback,
                Amount = 10.00m,
                AmountType = "credit",
                WalletType = "user",
                TransactionGroupId = groupId,
                Status = "completed"
            }
        };

        // Act
        _context.Transactions.AddRange(transactions);
        await _context.SaveChangesAsync();

        // Assert
        var groupedTransactions = await _context.Transactions
            .Where(t => t.TransactionGroupId == groupId)
            .ToListAsync();

        groupedTransactions.Should().HaveCount(2);
        groupedTransactions.All(t => t.TransactionGroupId == groupId).Should().BeTrue();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
}
