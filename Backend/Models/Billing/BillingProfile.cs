using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

public class BillingProfile
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public bool IsActive { get; set; } = true;
    
    // Advanced Options
    public bool IsOffer { get; set; } = false;
    public string? Platform { get; set; } // "Web", "MobileApp", "Both"
    public int? TotalQuantity { get; set; } // Total number available (null = unlimited)
    public int UsedQuantity { get; set; } = 0; // How many have been used
    public string? UserType { get; set; } // "New", "Renew", "Both"
    public int? ExpirationDays { get; set; } // Number of days until offer expires (null = no expiration)
    public DateTime? OfferStartDate { get; set; }
    public DateTime? OfferEndDate { get; set; }
    public bool RequiresApproval { get; set; } = false;
    public int? Priority { get; set; } // Display priority/order
    public string? Color { get; set; } // Hex color code for visual branding
    public string? Icon { get; set; } // Icon name for visual identification
    
    // Foreign keys
    public int RadiusProfileId { get; set; }
    public int? BillingGroupId { get; set; } // null means all groups
    
    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }
    
    // Navigation Properties
    [ForeignKey(nameof(DeletedBy))]
    public User? DeletedByUser { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    
    // Navigation Properties
    [ForeignKey(nameof(CreatedBy))]
    public User? CreatedByUser { get; set; }
    
    [ForeignKey(nameof(UpdatedBy))]
    public User? UpdatedByUser { get; set; }
    
    // Navigation properties
    [JsonIgnore]
    public virtual RadiusProfile RadiusProfile { get; set; } = null!;
    [JsonIgnore]
    public virtual BillingGroup? BillingGroup { get; set; }
    [JsonIgnore]
    public virtual ICollection<BillingProfileWallet> ProfileWallets { get; set; } = new List<BillingProfileWallet>();
    [JsonIgnore]
    public virtual ICollection<BillingProfileAddon> ProfileAddons { get; set; } = new List<BillingProfileAddon>();
    [JsonIgnore]
    public virtual ICollection<BillingProfileUser> ProfileUsers { get; set; } = new List<BillingProfileUser>();
}

// Direct user assignment for billing profile
public class BillingProfileUser
{
    public int Id { get; set; }
    public int BillingProfileId { get; set; }
    public int UserId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public int? AssignedBy { get; set; }
    
    [JsonIgnore]
    public virtual BillingProfile BillingProfile { get; set; } = null!;
    [JsonIgnore]
    public virtual User User { get; set; } = null!;
    [JsonIgnore]
    [ForeignKey(nameof(AssignedBy))]
    public virtual User? AssignedByUser { get; set; }
}

// Wallet configuration for billing profile
public class BillingProfileWallet
{
    public int Id { get; set; }
    public int BillingProfileId { get; set; }
    public string WalletType { get; set; } = null!; // "user" or "custom"
    public int? UserWalletId { get; set; } // Only if WalletType is "user"
    public int? CustomWalletId { get; set; } // Only if WalletType is "custom"
    public decimal Percentage { get; set; } // Now represents price instead of percentage
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public string? Direction { get; set; } // "in", "out", or "remaining"
    public int DisplayOrder { get; set; }
    
    [JsonIgnore]
    public virtual BillingProfile BillingProfile { get; set; } = null!;
    [JsonIgnore]
    public virtual UserWallet? UserWallet { get; set; }
    [JsonIgnore]
    public virtual CustomWallet? CustomWallet { get; set; }
}

// Addon configuration for billing profile
public class BillingProfileAddon
{
    public int Id { get; set; }
    public int BillingProfileId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int DisplayOrder { get; set; }
    
    [JsonIgnore]
    public virtual BillingProfile BillingProfile { get; set; } = null!;
}
