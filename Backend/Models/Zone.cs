using System.Text.Json.Serialization;

namespace Backend.Models;

public class Zone
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int WorkspaceId { get; set; } // Not a foreign key - just stores the workspace ID
    
    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    
    // Navigation properties (no Workspace navigation - it's in a different database)
    [JsonIgnore]
    public virtual ICollection<UserZone> UserZones { get; set; } = new List<UserZone>();
    [JsonIgnore]
    public virtual ICollection<RadiusUser> RadiusUsers { get; set; } = new List<RadiusUser>();
}

// Many-to-many relationship between User Management users and Zones
public class UserZone
{
    public int Id { get; set; }
    public string UserId { get; set; } = null!; // Keycloak user ID
    public int ZoneId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    
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
}

public class ZoneUpdateDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
}

public class ZoneResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int WorkspaceId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    public int UserCount { get; set; }
    public int RadiusUserCount { get; set; }
}

public class AssignUsersToZoneDto
{
    public List<string> UserIds { get; set; } = new();
}

public class AssignZonesToUserDto
{
    public List<int> ZoneIds { get; set; } = new();
}

public class AssignRadiusUsersToZoneDto
{
    public List<int> RadiusUserIds { get; set; } = new();
}
