using System.Text.Json.Serialization;

namespace Backend.DTOs;

/// <summary>
/// Enterprise-grade DTO for Workspace API responses
/// Prevents circular references and includes only necessary data
/// </summary>
public class WorkspaceResponseDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Building2";
    public string Currency { get; set; } = "USD";
    public int ChurnDays { get; set; } = 20;
    public string DateFormat { get; set; } = "MM/DD/YYYY";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    
    // User information (not full objects to avoid circular references)
    public int CreatedBy { get; set; }
    public int UpdatedBy { get; set; }
    public int? DeletedBy { get; set; }
    
    // Optional: Include user details if needed
    public UserSummaryDto? CreatedByUser { get; set; }
    public UserSummaryDto? UpdatedByUser { get; set; }
    public UserSummaryDto? DeletedByUser { get; set; }
}

/// <summary>
/// Lightweight user summary for nested responses
/// </summary>
public class UserSummaryDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FullName => !string.IsNullOrWhiteSpace(FirstName) || !string.IsNullOrWhiteSpace(LastName) 
        ? $"{FirstName} {LastName}".Trim() 
        : null;
}
