using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class RadiusActivation
{
    [Key]
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();

    // Who performed the action (user ID from master database)
    public int? ActionById { get; set; }
    
    // Username/email of who performed the action
    [MaxLength(255)]
    public string? ActionByUsername { get; set; }

    // Who the action was performed for (user ID from master database, if different from ActionBy)
    public int? ActionForId { get; set; }
    
    // Username/email of who the action was performed for
    [MaxLength(255)]
    public string? ActionForUsername { get; set; }

    // Was this action done on behalf of another user
    public bool IsActionBehalf { get; set; } = false;

    // Reference to the master billing activation record (many RadiusActivations to one BillingActivation)
    [Required]
    public int BillingActivationId { get; set; }
    
    [ForeignKey("BillingActivationId")]
    public BillingActivation? BillingActivation { get; set; }

    // Reference to the RADIUS user
    public int RadiusUserId { get; set; }
    
    [ForeignKey("RadiusUserId")]
    public RadiusUser? RadiusUser { get; set; }

    // RADIUS username for quick reference
    [MaxLength(255)]
    public string? RadiusUsername { get; set; }

    // Previous RADIUS profile (before change)
    public int? PreviousRadiusProfileId { get; set; }
    
    [ForeignKey("PreviousRadiusProfileId")]
    public RadiusProfile? PreviousRadiusProfile { get; set; }

    // New/Current RADIUS profile
    public int? RadiusProfileId { get; set; }
    
    [ForeignKey("RadiusProfileId")]
    public RadiusProfile? RadiusProfile { get; set; }

    // Previous Billing profile (before change)
    public int? PreviousBillingProfileId { get; set; }
    
    [ForeignKey("PreviousBillingProfileId")]
    public BillingProfile? PreviousBillingProfile { get; set; }

    // New/Current Billing profile
    public int? BillingProfileId { get; set; }
    
    [ForeignKey("BillingProfileId")]
    public BillingProfile? BillingProfile { get; set; }

    // Previous expiration date (before the action)
    public DateTime? PreviousExpireDate { get; set; }

    // Current/New expiration date (after the action)
    public DateTime? CurrentExpireDate { get; set; }

    // Next expected expiration date
    public DateTime? NextExpireDate { get; set; }

    // Previous balance (before the action)
    [Column(TypeName = "decimal(18,2)")]
    public decimal? PreviousBalance { get; set; }

    // New balance (after the action)
    [Column(TypeName = "decimal(18,2)")]
    public decimal? NewBalance { get; set; }

    // Amount charged/credited for this activation
    [Column(TypeName = "decimal(18,2)")]
    public decimal? Amount { get; set; }

    // Type of activation: renew, change_profile, new_activation, reactivation, suspension, extension, downgrade, upgrade
    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "renew";

    // Internal status: pending, processing, completed, failed, cancelled, rolled_back
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "pending";

    // API call status: success, failed, timeout, not_called
    [MaxLength(50)]
    public string? ApiStatus { get; set; }

    // API response code (HTTP status or custom code)
    public int? ApiStatusCode { get; set; }

    // API status message or error message
    [MaxLength(1000)]
    public string? ApiStatusMessage { get; set; }

    // Full API response (JSON) for debugging
    public string? ApiResponse { get; set; }

    // External reference ID (from SAS or other external system)
    [MaxLength(100)]
    public string? ExternalReferenceId { get; set; }

    // Transaction ID if linked to a transaction
    public int? TransactionId { get; set; }

    // Payment method used: balance, cash, credit, free, promotional
    [MaxLength(50)]
    public string? PaymentMethod { get; set; }

    // Duration in days for this activation
    public int? DurationDays { get; set; }

    // Profile change timing: Immediately, OnExpiration (null = no profile change)
    [MaxLength(20)]
    public string? ProfileChangeType { get; set; }

    // Scheduled date for profile change (used when ProfileChangeType = OnExpiration)
    public DateTime? ScheduledProfileChangeDate { get; set; }

    // Source of activation: web, api, auto_renew, admin, bulk, import
    [MaxLength(50)]
    public string? Source { get; set; }

    // IP address of the requester
    [MaxLength(50)]
    public string? IpAddress { get; set; }

    // User agent of the requester
    [MaxLength(500)]
    public string? UserAgent { get; set; }

    // Notes/comments about this activation
    [MaxLength(1000)]
    public string? Notes { get; set; }

    // Retry count for failed activations
    public int RetryCount { get; set; } = 0;

    // Last retry timestamp
    public DateTime? LastRetryAt { get; set; }

    // Processing started at
    public DateTime? ProcessingStartedAt { get; set; }

    // Processing completed at
    public DateTime? ProcessingCompletedAt { get; set; }

    // Soft Delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }    
    // Navigation Properties
    [ForeignKey(nameof(DeletedBy))]
    public User? DeletedByUser { get; set; }
    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

// Response model for API
public class RadiusActivationResponse
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int BillingActivationId { get; set; }
    public int? ActionById { get; set; }
    public string? ActionByUsername { get; set; }
    public int? ActionForId { get; set; }
    public string? ActionForUsername { get; set; }
    public bool IsActionBehalf { get; set; }
    public int RadiusUserId { get; set; }
    public string? RadiusUsername { get; set; }
    public int? PreviousRadiusProfileId { get; set; }
    public string? PreviousRadiusProfileName { get; set; }
    public int? RadiusProfileId { get; set; }
    public string? RadiusProfileName { get; set; }
    public int? PreviousBillingProfileId { get; set; }
    public string? PreviousBillingProfileName { get; set; }
    public int? BillingProfileId { get; set; }
    public string? BillingProfileName { get; set; }
    public DateTime? PreviousExpireDate { get; set; }
    public DateTime? CurrentExpireDate { get; set; }
    public DateTime? NextExpireDate { get; set; }
    public decimal? PreviousBalance { get; set; }
    public decimal? NewBalance { get; set; }
    public decimal? Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ApiStatus { get; set; }
    public int? ApiStatusCode { get; set; }
    public string? ApiStatusMessage { get; set; }
    public string? ExternalReferenceId { get; set; }
    public int? TransactionId { get; set; }
    public string? PaymentMethod { get; set; }
    public int? DurationDays { get; set; }
    public string? ProfileChangeType { get; set; }
    public DateTime? ScheduledProfileChangeDate { get; set; }
    public string? Source { get; set; }
    public string? IpAddress { get; set; }
    public string? Notes { get; set; }
    public int RetryCount { get; set; }
    public DateTime? ProcessingStartedAt { get; set; }
    public DateTime? ProcessingCompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }
}

// Request model for creating activation
public class CreateRadiusActivationRequest
{
    public int RadiusUserId { get; set; }
    public int? RadiusProfileId { get; set; }
    public int? BillingProfileId { get; set; }
    public DateTime? NextExpireDate { get; set; }
    public decimal? Amount { get; set; }
    public string Type { get; set; } = "renew";
    public string? PaymentMethod { get; set; }
    public int? DurationDays { get; set; }
    public string? ProfileChangeType { get; set; }
    public DateTime? ScheduledProfileChangeDate { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
    public bool IsActionBehalf { get; set; } = false;
    public int? ActionForId { get; set; }
    public string? ActionForUsername { get; set; }
    
    // For on-behalf activations: whose wallet to deduct from
    public int? PayerUserId { get; set; }
    public string? PayerUsername { get; set; }
    
    // Whether to apply cashback to payer's wallet
    public bool ApplyCashback { get; set; } = false;
}
