namespace Backend.Models;

public class Transaction
{
    public int Id { get; set; }
    
    // Transaction basic info
    public string TransactionType { get; set; } = null!; // Using TransactionType constants
    public bool IsCredit { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = "completed"; // completed, pending, cancelled, reversed
    
    // Wallet references
    public string WalletType { get; set; } = null!; // 'custom' or 'user'
    public int? CustomWalletId { get; set; }
    public int? UserWalletId { get; set; }
    
    // User reference (for user wallets)
    public int? UserId { get; set; }
    
    // Balance tracking
    public decimal BalanceBefore { get; set; }
    public decimal BalanceAfter { get; set; }
    
    // Transaction details
    public string? Description { get; set; }
    public string? Reason { get; set; }
    public string? Reference { get; set; }
    public string? PaymentMethod { get; set; }
    
    // Related transaction for reversals
    public int? RelatedTransactionId { get; set; } // Link to original transaction when reversed
    
    // Metadata
    public string? Metadata { get; set; } // JSON for additional data
    
    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    
    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Navigation properties
    public CustomWallet? CustomWallet { get; set; }
    public UserWallet? UserWallet { get; set; }
    public Transaction? RelatedTransaction { get; set; }
}
