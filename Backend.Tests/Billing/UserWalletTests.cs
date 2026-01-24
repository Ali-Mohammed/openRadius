using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests.Billing;

/// <summary>
/// Unit tests for UserWallet functionality
/// Tests cover wallet creation, updates, transactions, and balance management
/// </summary>
public class UserWalletTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly CustomWallet _testCustomWallet;

    public UserWalletTests()
    {
        // Setup in-memory database
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

        _context.CustomWallets.Add(_testCustomWallet);
        _context.SaveChanges();
    }

    [Fact]
    public async Task CreateUserWallet_WithValidData_ShouldSucceed()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            Status = "active",
            AllowNegativeBalance = false
        };

        // Act
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Assert
        var savedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        savedWallet.Should().NotBeNull();
        savedWallet!.Id.Should().BeGreaterThan(0);
        savedWallet.CurrentBalance.Should().Be(100.00m);
        savedWallet.Status.Should().Be("active");
        savedWallet.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task CreateUserWallet_WithZeroBalance_ShouldSucceed()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 0m,
            Status = "active"
        };

        // Act
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Assert
        var savedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        savedWallet.Should().NotBeNull();
        savedWallet!.CurrentBalance.Should().Be(0m);
    }

    [Fact]
    public async Task CreateUserWallet_WithNegativeBalanceAllowed_ShouldSucceed()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = -50.00m,
            Status = "active",
            AllowNegativeBalance = true
        };

        // Act
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Assert
        var savedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        savedWallet.Should().NotBeNull();
        savedWallet!.CurrentBalance.Should().Be(-50.00m);
        savedWallet.AllowNegativeBalance.Should().BeTrue();
    }

    [Fact]
    public async Task GetUserWallet_WhenExists_ShouldReturnWallet()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            Status = "active"
        };
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Act
        var foundWallet = await _context.UserWallets.FindAsync(wallet.Id);

        // Assert
        foundWallet.Should().NotBeNull();
        foundWallet!.Id.Should().Be(wallet.Id);
    }

    [Fact]
    public async Task GetUserWallet_WhenNotExists_ShouldReturnNull()
    {
        // Act
        var foundWallet = await _context.UserWallets.FindAsync(999);

        // Assert
        foundWallet.Should().BeNull();
    }

    [Fact]
    public async Task UpdateWalletBalance_AddFunds_ShouldIncreaseBalance()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            Status = "active"
        };
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Act
        wallet.CurrentBalance += 50.00m;
        wallet.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Assert
        var updatedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        updatedWallet!.CurrentBalance.Should().Be(150.00m);
        updatedWallet.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateWalletBalance_DeductFunds_ShouldDecreaseBalance()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            Status = "active"
        };
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Act
        wallet.CurrentBalance -= 30.00m;
        await _context.SaveChangesAsync();

        // Assert
        var updatedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        updatedWallet!.CurrentBalance.Should().Be(70.00m);
    }

    [Fact]
    public async Task GetUserWallets_ForUser_ShouldReturnAllWallets()
    {
        // Arrange
        var wallets = new[]
        {
            new UserWallet { UserId = 1, CustomWalletId = _testCustomWallet.Id, CurrentBalance = 100.00m, Status = "active" },
            new UserWallet { UserId = 1, CustomWalletId = _testCustomWallet.Id, CurrentBalance = 200.00m, Status = "active" },
            new UserWallet { UserId = 2, CustomWalletId = _testCustomWallet.Id, CurrentBalance = 300.00m, Status = "active" }
        };

        _context.UserWallets.AddRange(wallets);
        await _context.SaveChangesAsync();

        // Act
        var userWallets = await _context.UserWallets
            .Where(w => w.UserId == 1)
            .ToListAsync();

        // Assert
        userWallets.Should().HaveCount(2);
        userWallets.All(w => w.UserId == 1).Should().BeTrue();
    }

    [Fact]
    public async Task SoftDeleteWallet_ShouldMarkAsDeleted()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            Status = "active"
        };
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Act
        wallet.DeletedAt = DateTime.UtcNow;
        wallet.Status = "deleted";
        await _context.SaveChangesAsync();

        // Assert
        var deletedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        deletedWallet!.DeletedAt.Should().NotBeNull();
        deletedWallet.Status.Should().Be("deleted");
    }

    [Fact]
    public async Task WalletStatus_Changes_ShouldBeTracked()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            Status = "active"
        };
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Act
        wallet.Status = "suspended";
        wallet.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Assert
        var updatedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        updatedWallet!.Status.Should().Be("suspended");
        updatedWallet.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MultipleWallets_SameUser_DifferentCustomWallets_ShouldBeAllowed()
    {
        // Arrange
        var customWallet2 = new CustomWallet
        {
            Name = "Second Wallet",
            Icon = "star",
            Color = "#00FF00",
            AllowNegativeBalance = true,
            IsDeleted = false
        };
        _context.CustomWallets.Add(customWallet2);
        await _context.SaveChangesAsync();

        var wallets = new[]
        {
            new UserWallet { UserId = 1, CustomWalletId = _testCustomWallet.Id, CurrentBalance = 100.00m },
            new UserWallet { UserId = 1, CustomWalletId = customWallet2.Id, CurrentBalance = 200.00m }
        };

        // Act
        _context.UserWallets.AddRange(wallets);
        await _context.SaveChangesAsync();

        // Assert
        var userWallets = await _context.UserWallets
            .Where(w => w.UserId == 1)
            .ToListAsync();

        userWallets.Should().HaveCount(2);
        userWallets.Select(w => w.CustomWalletId).Distinct().Should().HaveCount(2);
    }

    [Fact]
    public async Task Wallet_WithLimits_ShouldStoreCorrectly()
    {
        // Arrange
        var wallet = new UserWallet
        {
            UserId = 1,
            CustomWalletId = _testCustomWallet.Id,
            CurrentBalance = 100.00m,
            MaxFillLimit = 1000.00m,
            MinFillAmount = 10.00m,
            Status = "active"
        };

        // Act
        _context.UserWallets.Add(wallet);
        await _context.SaveChangesAsync();

        // Assert
        var savedWallet = await _context.UserWallets.FindAsync(wallet.Id);
        savedWallet!.MaxFillLimit.Should().Be(1000.00m);
        savedWallet.MinFillAmount.Should().Be(10.00m);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
}
