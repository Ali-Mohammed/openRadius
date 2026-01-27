using System.Text.Json.Serialization;

namespace Backend.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ActivationMethod
{
    ManagerBalance,
    PrepaidCard,
    UserBalance,
    RewardPoints
}

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
    
    // Advanced Activation Settings
    public ActivationMethod ActivationMethod { get; set; } = ActivationMethod.ManagerBalance; // How activations are funded
    public int? CardStockUserId { get; set; } // User ID who holds card stock (for PrepaidCard method)
    public bool AllowAnyCardStockUser { get; set; } = false; // Allow selecting any user with cards (for PrepaidCard method)
    public bool UseFreeCardsOnly { get; set; } = false; // Only use unassigned/free cards (for PrepaidCard method)

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}


