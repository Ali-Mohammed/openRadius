using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class WorkflowHistory
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int AutomationId { get; set; }
    public string WorkflowJson { get; set; } = null!;
    public int NodeCount { get; set; }
    public int EdgeCount { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    
    // Navigation Properties
    [ForeignKey(nameof(CreatedBy))]
    public User? CreatedByUser { get; set; }
    
    // Navigation property
    public Automation? Automation { get; set; }
}
