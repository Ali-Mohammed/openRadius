using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class Transaction
{
    public int Id { get; set; }
    
    // Transaction basic info
    public string TransactionType { get; set; } = null!; // Using TransactionType constants
    public string AmountType { get; set; } = "credit"; // "credit" or "debit"
    public decimal Amount { get; set; }
    public string Status { get; set; } = "completed"; // completed, pending, cancelled, reversed
    public string? CashbackStatus { get; set; } // "Completed", "Pending", or "WaitingForApproval"
    
    // Wallet references
    public string WalletType { get; set; } = null!; // 'custom' or 'user'
    public int? CustomWalletId { get; set; }
    public int? UserWalletId { get; set; }
    
    // User reference (for user wallets)
    public int? UserId { get; set; }
    
    // RADIUS user reference (for activation transactions)
    public int? RadiusUserId { get; set; }
    public string? RadiusUsername { get; set; }
    
    // Profile references (for activation transactions)
    public int? RadiusProfileId { get; set; }
    public string? RadiusProfileName { get; set; }
    public int? BillingProfileId { get; set; }
    public string? BillingProfileName { get; set; }
    
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
    
    // Activation references (for activation-related transactions)
    public int? ActivationId { get; set; } // DEPRECATED: Legacy link to RadiusActivation
    public int? BillingActivationId { get; set; } // Link to master BillingActivation record
    
    // Metadata
    public string? Metadata { get; set; } // JSON for additional data
    
    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public int? UpdatedBy { get; set; }
    
    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }
        // Navigation Properties
    [ForeignKey(nameof(CreatedBy))]
    public User? CreatedByUser { get; set; }
    
    [ForeignKey(nameof(UpdatedBy))]
    public User? UpdatedByUser { get; set; }
    
    [ForeignKey(nameof(DeletedBy))]
    public User? DeletedByUser { get; set; }
        // Navigation properties
    public CustomWallet? CustomWallet { get; set; }
    public UserWallet? UserWallet { get; set; }
    public Transaction? RelatedTransaction { get; set; }
}
