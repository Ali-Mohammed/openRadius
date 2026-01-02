using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public enum SyncStatus
{
    Starting = 0,
    Authenticating = 1,
    SyncingProfiles = 2,
    FetchingProfilePage = 3,
    ProcessingProfiles = 4,
    SyncingUsers = 5,
    FetchingUserPage = 6,
    ProcessingUsers = 7,
    Completed = 8,
    Failed = 9,
    Cancelled = 10
}

public enum SyncPhase
{
    NotStarted = 0,
    Profiles = 1,
    Users = 2,
    Completed = 3
}

public class SyncProgress
{
    [Key]
    public Guid SyncId { get; set; }
    
    public int IntegrationId { get; set; }
    public string IntegrationName { get; set; } = string.Empty;
    
    public int InstantId { get; set; }
    
    public SyncStatus Status { get; set; }
    public SyncPhase CurrentPhase { get; set; }
    
    // Profile sync tracking
    public int ProfileCurrentPage { get; set; }
    public int ProfileTotalPages { get; set; }
    public int ProfileTotalRecords { get; set; }
    public int ProfileProcessedRecords { get; set; }
    public int ProfileNewRecords { get; set; }
    public int ProfileUpdatedRecords { get; set; }
    public int ProfileFailedRecords { get; set; }
    
    // User sync tracking
    public int UserCurrentPage { get; set; }
    public int UserTotalPages { get; set; }
    public int UserTotalRecords { get; set; }
    public int UserProcessedRecords { get; set; }
    public int UserNewRecords { get; set; }
    public int UserUpdatedRecords { get; set; }
    public int UserFailedRecords { get; set; }
    
    // Overall progress
    public double ProgressPercentage { get; set; }
    public string? CurrentMessage { get; set; }
    public string? ErrorMessage { get; set; }
    
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}

public class SyncProgressUpdate
{
    public Guid SyncId { get; set; }
    public int IntegrationId { get; set; }
    public string IntegrationName { get; set; } = string.Empty;
    public int InstantId { get; set; }
    public SyncStatus Status { get; set; }
    public SyncPhase CurrentPhase { get; set; }
    
    public int ProfileCurrentPage { get; set; }
    public int ProfileTotalPages { get; set; }
    public int ProfileTotalRecords { get; set; }
    public int ProfileProcessedRecords { get; set; }
    public int ProfileNewRecords { get; set; }
    public int ProfileUpdatedRecords { get; set; }
    public int ProfileFailedRecords { get; set; }
    
    public int UserCurrentPage { get; set; }
    public int UserTotalPages { get; set; }
    public int UserTotalRecords { get; set; }
    public int UserProcessedRecords { get; set; }
    public int UserNewRecords { get; set; }
    public int UserUpdatedRecords { get; set; }
    public int UserFailedRecords { get; set; }
    
    public double ProgressPercentage { get; set; }
    public string? CurrentMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime Timestamp { get; set; }
}
