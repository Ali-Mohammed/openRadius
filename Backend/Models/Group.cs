using System.Text.Json.Serialization;

namespace Backend.Models;

public class BillingGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
    
    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    
    // Navigation properties
    [JsonIgnore]
    public virtual ICollection<BillingGroupUser> GroupUsers { get; set; } = new List<BillingGroupUser>();
}

// Junction table for many-to-many relationship
public class BillingGroupUser
{
    public int GroupId { get; set; }
    public int UserId { get; set; }
    
    [JsonIgnore]
    public virtual BillingGroup Group { get; set; } = null!;
    // Note: User is in master DB, not workspace DB, so no navigation property here
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
}
