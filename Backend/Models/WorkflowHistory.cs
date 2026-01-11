namespace Backend.Models;

public class WorkflowHistory
{
    public int Id { get; set; }
    public int AutomationId { get; set; }
    public string WorkflowJson { get; set; } = null!;
    public int NodeCount { get; set; }
    public int EdgeCount { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    
    // Navigation property
    public Automation? Automation { get; set; }
}
