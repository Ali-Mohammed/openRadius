using System.Text.Json.Serialization;

namespace Backend.Models;

public class Automation
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public string Status { get; set; } = "draft"; // draft, active, paused, inactive
    public bool IsActive { get; set; } = true;
    public string? WorkflowJson { get; set; } // Stores the workflow definition
    
    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
