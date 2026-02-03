using System.Text.Json.Serialization;

namespace Backend.Models;

public class SasRadiusIntegration
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
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
    public string ActivationMethod { get; set; } = "ManagerBalance"; // How activations are funded (ManagerBalance, PrepaidCard, UserBalance, RewardPoints)
    public int? CardStockUserId { get; set; } // User ID who holds card stock (for PrepaidCard method)
    public bool AllowAnyCardStockUser { get; set; } = false; // Allow selecting any user with cards (for PrepaidCard method)
    public bool UseFreeCardsOnly { get; set; } = false; // Only use unassigned/free cards (for PrepaidCard method)

    // Sync Online Users Settings
    public bool SyncOnlineUsers { get; set; } = false; // Enable/disable periodic sync of online users from RADIUS to SAS4
    public int SyncOnlineUsersIntervalMinutes { get; set; } = 5; // Interval in minutes for syncing online users
    public int SessionSyncRecordsPerPage { get; set; } = 500; // Number of records to fetch per page when syncing online users
    
    // Live Sessions Data Source
    public bool UseSas4ForLiveSessions { get; set; } = false; // Pull live sessions data from SAS4 instead of internal OpenRadius system

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}


