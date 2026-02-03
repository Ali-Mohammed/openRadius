using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

public class Zone
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }

    public int? ParentZoneId { get; set; } // For hierarchical zones
    public int? SasUserId { get; set; } // SAS Manager tree user ID for sync tracking
    
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
    
    // Navigation properties (no Workspace navigation - it's in a different database)
    [JsonIgnore]
    public virtual Zone? ParentZone { get; set; }
    [JsonIgnore]
    public virtual ICollection<Zone> Children { get; set; } = new List<Zone>();
    [JsonIgnore]
    public virtual ICollection<UserZone> UserZones { get; set; } = new List<UserZone>();
    [JsonIgnore]
    public virtual ICollection<RadiusUser> RadiusUsers { get; set; } = new List<RadiusUser>();
}

// Many-to-many relationship between User Management users and Zones
public class UserZone
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int UserId { get; set; } // System user ID (from Users table)
    public int ZoneId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    
    // Navigation Properties
    [ForeignKey(nameof(CreatedBy))]
    public User? CreatedByUser { get; set; }
    
    // Navigation properties
    [JsonIgnore]
    public virtual Zone Zone { get; set; } = null!;
}

public class ZoneCreateDto
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int? ParentZoneId { get; set; }
}

public class ZoneUpdateDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int? ParentZoneId { get; set; }
}

public class ZoneResponse
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int WorkspaceId { get; set; }
    public int? ParentZoneId { get; set; }
    public string? ParentZoneName { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }
    public int UserCount { get; set; }
    public int RadiusUserCount { get; set; }
    public List<ZoneResponse> Children { get; set; } = new();
    public List<UserBasicInfo> Users { get; set; } = new();
}

public class UserBasicInfo
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
}

public class AssignUsersToZoneDto
{
    public List<int> UserIds { get; set; } = new();
}

public class AssignZonesToUserDto
{
    public List<int> ZoneIds { get; set; } = new();
}

public class AssignRadiusUsersToZoneDto
{
    public List<int> RadiusUserIds { get; set; } = new();
}
