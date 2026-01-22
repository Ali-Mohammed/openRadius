using System.Text.Json.Serialization;

namespace Backend.Models;

public class BillingProfile
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal? Price { get; set; }    public bool IsActive { get; set; } = true;    
    // Foreign keys
    public int RadiusProfileId { get; set; }
    public int? BillingGroupId { get; set; } // null means all groups
    
    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    
    // Navigation properties
    [JsonIgnore]
    public virtual RadiusProfile RadiusProfile { get; set; } = null!;
    [JsonIgnore]
    public virtual BillingGroup? BillingGroup { get; set; }
    [JsonIgnore]
    public virtual ICollection<BillingProfileWallet> ProfileWallets { get; set; } = new List<BillingProfileWallet>();
    [JsonIgnore]
    public virtual ICollection<BillingProfileAddon> ProfileAddons { get; set; } = new List<BillingProfileAddon>();
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
