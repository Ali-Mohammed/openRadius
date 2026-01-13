namespace Backend.Models;

/// <summary>
/// Represents a RADIUS group entity for organizing users
/// </summary>
public class RadiusGroup
{
    public int Id { get; set; }
    public int? ExternalId { get; set; } // SAS Reference ID for syncing
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Subscription { get; set; }
    public bool IsActive { get; set; } = true;
    public string Color { get; set; } = "#3b82f6"; // Default blue color
    public string Icon { get; set; } = "Users"; // Default icon
    
    // Soft Delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LastSyncedAt { get; set; } // Last time synced from SAS
}

// Response Models for API
public class RadiusGroupResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subscription { get; set; }
    public bool IsActive { get; set; }
    public string Color { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public int UsersCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Request Models for API
public class CreateGroupRequest
{
    public required string Name { get; set; }
    public string? Subscription { get; set; }
    public bool IsActive { get; set; } = true;
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Users";
}

public class UpdateGroupRequest
{
    public string? Name { get; set; }
    public string? Subscription { get; set; }
    public bool? IsActive { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
}
