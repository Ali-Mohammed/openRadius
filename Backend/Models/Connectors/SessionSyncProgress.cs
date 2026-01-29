using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public enum SessionSyncStatus
{
    Starting = 0,
    Authenticating = 1,
    FetchingOnlineUsers = 2,
    ProcessingUsers = 3,
    SyncingToSas = 4,
    Completed = 5,
    Failed = 6,
    Cancelled = 7
}

public class SessionSyncProgress
{
    [Key]
    public Guid SyncId { get; set; }
    
    public int IntegrationId { get; set; }
    public string IntegrationName { get; set; } = string.Empty;
    public int WorkspaceId { get; set; }
    
    public SessionSyncStatus Status { get; set; }
    
    // Session sync tracking
    public int TotalOnlineUsers { get; set; }
    public int ProcessedUsers { get; set; }
    public int SuccessfulSyncs { get; set; }
    public int FailedSyncs { get; set; }
    public int NewSessions { get; set; }
    public int UpdatedSessions { get; set; }
    
    // Overall progress
    public double ProgressPercentage { get; set; }
    public string? CurrentMessage { get; set; }
    public string? ErrorMessage { get; set; }
    
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }
    
    // Duration tracking
    [NotMapped]
    public TimeSpan Duration => CompletedAt.HasValue 
        ? CompletedAt.Value - StartedAt 
        : DateTime.UtcNow - StartedAt;
    
    [NotMapped]
    public int DurationSeconds => (int)Duration.TotalSeconds;
}
