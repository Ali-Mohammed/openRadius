using System.ComponentModel.DataAnnotations.Schema;
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
}
