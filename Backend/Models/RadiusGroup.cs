namespace Backend.Models;

/// <summary>
/// Represents a RADIUS group entity for organizing users
/// </summary>
public class RadiusGroup
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Subscription { get; set; }
    public bool IsActive { get; set; } = true;
    
    // Soft Delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // Foreign Keys
    public int WorkspaceId { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Response Models for API
public class RadiusGroupResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subscription { get; set; }
    public bool IsActive { get; set; }
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
}

public class UpdateGroupRequest
{
    public string? Name { get; set; }
    public string? Subscription { get; set; }
    public bool? IsActive { get; set; }
}
