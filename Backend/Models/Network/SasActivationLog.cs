namespace Backend.Models;

public class SasActivationLog
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int IntegrationId { get; set; }
    public required string IntegrationName { get; set; }
    public int UserId { get; set; }
    public required string Username { get; set; }
    public required string ActivationData { get; set; }
    
    // PIN tracking for prepaid card activations
    public string? Pin { get; set; }
    public string? CardSeries { get; set; }
    public string? CardSerialNumber { get; set; }
    
    // Status tracking
    public ActivationStatus Status { get; set; }
    public int RetryCount { get; set; }
    public int MaxRetries { get; set; } = 3;
    
    // Timing
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public long DurationMs { get; set; }
    
    // Response tracking
    public string? ResponseBody { get; set; }
    public int? ResponseStatusCode { get; set; }
    public string? ErrorMessage { get; set; }
    
    // Hangfire job tracking
    public string? JobId { get; set; }
    public DateTime? NextRetryAt { get; set; }
    
    // Navigation
    public SasRadiusIntegration? Integration { get; set; }
}

public enum ActivationStatus
{
    Pending = 0,
    Processing = 1,
    Success = 2,
    Failed = 3,
    MaxRetriesReached = 4,
    Cancelled = 5
}
