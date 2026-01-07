namespace Backend.Models;

public class WalletHistory
{
    public int Id { get; set; }
    
    // Wallet type: 'custom' or 'user'
    public string WalletType { get; set; } = null!;
    
    // Reference to the wallet
    public int? CustomWalletId { get; set; }
    public int? UserWalletId { get; set; }
    
    // Transaction details
    public string TransactionType { get; set; } = null!; // topup, withdrawal, transfer, adjustment, purchase, refund, payment, reward, fee, commission
    public string AmountType { get; set; } = "credit"; // "credit" or "debit"
    public decimal Amount { get; set; }
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    
    // Additional information
    public string? Description { get; set; }
    public string? Reason { get; set; }
    public string? Reference { get; set; } // External reference number
    
    // For user wallets, track which user
    public int? UserId { get; set; }
    
    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    
    // Navigation properties
    public CustomWallet? CustomWallet { get; set; }
    public UserWallet? UserWallet { get; set; }
}
