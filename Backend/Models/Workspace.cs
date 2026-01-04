namespace Backend.Models;

public class Workspace
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
    public string Currency { get; set; } = "USD"; // USD or IQD
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;
    public string UpdatedBy { get; set; } = string.Empty;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
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


