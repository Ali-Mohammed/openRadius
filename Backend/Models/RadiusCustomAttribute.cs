namespace Backend.Models;

public class RadiusCustomAttribute
{
    public int Id { get; set; }
    
    /// <summary>
    /// The attribute name (e.g., "Alc-SLA-Prof-Str", "subscriber:sub-qos-policy-out")
    /// </summary>
    public required string AttributeName { get; set; }
    
    /// <summary>
    /// The attribute value (e.g., "P1", "UPLOAD", "8.8.8.8")
    /// </summary>
    public required string AttributeValue { get; set; }
    
    /// <summary>
    /// Link type: "user" or "profile"
    /// </summary>
    public required string LinkType { get; set; }
    
    /// <summary>
    /// Foreign key to RadiusUser (if LinkType is "user")
    /// </summary>
    public int? RadiusUserId { get; set; }
    public RadiusUser? RadiusUser { get; set; }
    
    /// <summary>
    /// Foreign key to RadiusProfile (if LinkType is "profile")
    /// </summary>
    public int? RadiusProfileId { get; set; }
    public RadiusProfile? RadiusProfile { get; set; }
    
    /// <summary>
    /// Whether this attribute is enabled
    /// </summary>
    public bool Enabled { get; set; } = true;
    
    // Multi-tenancy
    public int WorkspaceId { get; set; }
    
    // Soft Delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class RadiusCustomAttributeResponse
{
    public int Id { get; set; }
    public string AttributeName { get; set; } = string.Empty;
    public string AttributeValue { get; set; } = string.Empty;
    public string LinkType { get; set; } = string.Empty;
    public int? RadiusUserId { get; set; }
    public string? RadiusUsername { get; set; };
    public int? RadiusProfileId { get; set; }
    public string? RadiusProfileName { get; set; }
    public bool Enabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateRadiusCustomAttributeRequest
{
    public required string AttributeName { get; set; }
    public required string AttributeValue { get; set; }
    public required string LinkType { get; set; } // "user" or "profile"
    public int? RadiusUserId { get; set; }
    public int? RadiusProfileId { get; set; }
    public bool Enabled { get; set; } = true;
}

public class UpdateRadiusCustomAttributeRequest
{
    public string? AttributeName { get; set; }
    public string? AttributeValue { get; set; }
    public string? LinkType { get; set; }
    public int? RadiusUserId { get; set; }
    public int? RadiusProfileId { get; set; }
    public bool? Enabled { get; set; }
}
