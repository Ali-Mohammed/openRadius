using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

public class Workspace
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Building2";
    public string Currency { get; set; } = "USD"; // USD or IQD
    public int ChurnDays { get; set; } = 20; // Number of days for user to become churn user
    public string DateFormat { get; set; } = "MM/DD/YYYY"; // Date format for the system
    public string? TagSyncRules { get; set; } // JSON string containing tag sync rules
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Foreign Keys
    public int CreatedBy { get; set; }
    public int UpdatedBy { get; set; }
    public int? DeletedBy { get; set; }
    
    // Navigation Properties
    [ForeignKey(nameof(CreatedBy))]
    [JsonIgnore]
    public User? CreatedByUser { get; set; }
    
    [ForeignKey(nameof(UpdatedBy))]
    [JsonIgnore]
    public User? UpdatedByUser { get; set; }
    
    [ForeignKey(nameof(DeletedBy))]
    [JsonIgnore]
    public User? DeletedByUser { get; set; }
    
    public DateTime? DeletedAt { get; set; }
}

public class WorkspaceDto
{
    public string Title { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Building2";
}

public class WorkspaceImportDto
{
    public string? Title { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Comments { get; set; }
    public string? Status { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public string? Currency { get; set; }
}


