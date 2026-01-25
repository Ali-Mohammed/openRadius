namespace Backend.Models;

public class IntegrationWebhook
{
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    public string IntegrationName { get; set; } = string.Empty;
    public string IntegrationType { get; set; } = "sas-radius"; // sas-radius, custom, etc.
    
    // Webhook configuration
    public bool CallbackEnabled { get; set; } = false;
    public string WebhookToken { get; set; } = string.Empty; // Unique secure token
    public string WebhookUrl { get; set; } = string.Empty; // Auto-generated URL
    
    // Security
    public bool RequireAuthentication { get; set; } = true;
    public string? AllowedIpAddresses { get; set; } // JSON array of allowed IPs
    
    // Settings
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }
    
    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public int RequestCount { get; set; } = 0;
    
    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
}
