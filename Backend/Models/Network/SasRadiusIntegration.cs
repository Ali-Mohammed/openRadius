namespace Backend.Models;

public class SasRadiusIntegration
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Url { get; set; }
    public required string Username { get; set; }
    public required string Password { get; set; }
    public bool UseHttps { get; set; }
    public bool IsActive { get; set; }
    public int MaxItemInPagePerRequest { get; set; } = 100; // Items per page for each API request
    public string? Action { get; set; }
    public string? Description { get; set; }
    public bool SendActivationsToSas { get; set; } = false; // Send activations to SAS4 for active users
    
    // Activation Queue Settings (only used when SendActivationsToSas = true)
    public int ActivationMaxRetries { get; set; } = 3; // Max retry attempts for failed activations
    public int ActivationRetryDelayMinutes { get; set; } = 2; // Base delay in minutes before first retry
    public bool ActivationUseExponentialBackoff { get; set; } = true; // Use exponential backoff (2^retryCount * base delay)
    public int ActivationTimeoutSeconds { get; set; } = 30; // HTTP request timeout in seconds
    public int ActivationMaxConcurrency { get; set; } = 1; // Max concurrent activations (1 = sequential, >1 = parallel)

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}


