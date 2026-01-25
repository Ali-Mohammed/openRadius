namespace Backend.Models;

public class WebhookLog
{
    public int Id { get; set; }
    public int WebhookId { get; set; }
    public int WorkspaceId { get; set; }
    
    // Request details
    public string Method { get; set; } = "POST";
    public string? IpAddress { get; set; }
    public string? Headers { get; set; } // JSON
    public string? RequestBody { get; set; }
    
    // Response details
    public int StatusCode { get; set; }
    public string? ResponseBody { get; set; }
    public string? ErrorMessage { get; set; }
    
    // Processing
    public bool Success { get; set; }
    public int ProcessingTimeMs { get; set; }
    
    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
