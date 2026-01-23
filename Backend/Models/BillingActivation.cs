using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

/// <summary>
/// Tracks detailed billing activations for reporting and audit purposes
/// Stores complete activation data for billing analysis
/// </summary>
public class BillingActivation
{
    [Key]
    public int Id { get; set; }

    // Reference to the activation (nullable since BillingActivation is created first)
    public int? RadiusActivationId { get; set; }
    
    [ForeignKey("RadiusActivationId")]
    public RadiusActivation? RadiusActivation { get; set; }

    // Billing profile information
    public int? BillingProfileId { get; set; }
    
    [ForeignKey("BillingProfileId")]
    public BillingProfile? BillingProfile { get; set; }

    [MaxLength(255)]
    public string? BillingProfileName { get; set; }

    // User information
    public int RadiusUserId { get; set; }
    
    [MaxLength(255)]
    public string? RadiusUsername { get; set; }

    public int? ActionById { get; set; }
    
    [MaxLength(255)]
    public string? ActionByUsername { get; set; }

    public int? ActionForId { get; set; }
    
    [MaxLength(255)]
    public string? ActionForUsername { get; set; }

    public bool IsActionBehalf { get; set; } = false;

    // Financial information
    [Column(TypeName = "decimal(18,2)")]
    public decimal? Amount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? CashbackAmount { get; set; }

    // Activation details
    [MaxLength(50)]
    public string? ActivationType { get; set; }

    [MaxLength(50)]
    public string? ActivationStatus { get; set; }

    [MaxLength(50)]
    public string? PaymentMethod { get; set; }

    public DateTime? PreviousExpireDate { get; set; }
    
    public DateTime? NewExpireDate { get; set; }

    public int? DurationDays { get; set; }

    // RADIUS Profile information
    public int? RadiusProfileId { get; set; }
    
    [MaxLength(255)]
    public string? RadiusProfileName { get; set; }

    // Primary transaction reference (typically the main payment transaction)
    public int? TransactionId { get; set; }
    
    [ForeignKey("TransactionId")]
    public Transaction? Transaction { get; set; }

    // Source of activation
    [MaxLength(50)]
    public string? Source { get; set; }

    // IP address and user agent for audit
    [MaxLength(50)]
    public string? IpAddress { get; set; }

    [MaxLength(500)]
    public string? UserAgent { get; set; }

    // Notes
    [MaxLength(1000)]
    public string? Notes { get; set; }

    // Wallet distribution summary
    public string? WalletDistribution { get; set; } // JSON string with wallet distribution details

    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? ProcessingStartedAt { get; set; }
    
    public DateTime? ProcessingCompletedAt { get; set; }

    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }
}
