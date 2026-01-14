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
    Groups = 2,
    Zones = 3,
    Users = 4,
    Nas = 5,
    Completed = 6
}

public class SyncProgress
{
    [Key]
    public Guid SyncId { get; set; }
    
    public int IntegrationId { get; set; }
    public string IntegrationName { get; set; } = string.Empty;
    
    public int WorkspaceId { get; set; }
    
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
    
    // Group sync tracking
    public int GroupCurrentPage { get; set; }
    public int GroupTotalPages { get; set; }
    public int GroupTotalRecords { get; set; }
    public int GroupProcessedRecords { get; set; }
    public int GroupNewRecords { get; set; }
    public int GroupUpdatedRecords { get; set; }
    public int GroupFailedRecords { get; set; }
    
    // Zone sync tracking
    public int ZoneTotalRecords { get; set; }
    public int ZoneProcessedRecords { get; set; }
    public int ZoneNewRecords { get; set; }
    public int ZoneUpdatedRecords { get; set; }
    public int ZoneFailedRecords { get; set; }
    
    // User sync tracking
    public int UserCurrentPage { get; set; }
    public int UserTotalPages { get; set; }
    public int UserTotalRecords { get; set; }
    public int UserProcessedRecords { get; set; }
    public int UserNewRecords { get; set; }
    public int UserUpdatedRecords { get; set; }
    public int UserFailedRecords { get; set; }
    
    // NAS sync tracking
    public int NasCurrentPage { get; set; }
    public int NasTotalPages { get; set; }
    public int NasTotalRecords { get; set; }
    public int NasProcessedRecords { get; set; }
    public int NasNewRecords { get; set; }
    public int NasUpdatedRecords { get; set; }
    public int NasFailedRecords { get; set; }
    
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
    public int WorkspaceId { get; set; }
    public SyncStatus Status { get; set; }
    public SyncPhase CurrentPhase { get; set; }
    
    public int ProfileCurrentPage { get; set; }
    public int ProfileTotalPages { get; set; }
    public int ProfileTotalRecords { get; set; }
    public int ProfileProcessedRecords { get; set; }
    public int ProfileNewRecords { get; set; }
    public int ProfileUpdatedRecords { get; set; }
    public int ProfileFailedRecords { get; set; }
    
    public int GroupCurrentPage { get; set; }
    public int GroupTotalPages { get; set; }
    public int GroupTotalRecords { get; set; }
    public int GroupProcessedRecords { get; set; }
    public int GroupNewRecords { get; set; }
    public int GroupUpdatedRecords { get; set; }
    public int GroupFailedRecords { get; set; }
    
    public int ZoneTotalRecords { get; set; }
    public int ZoneProcessedRecords { get; set; }
    public int ZoneNewRecords { get; set; }
    public int ZoneUpdatedRecords { get; set; }
    public int ZoneFailedRecords { get; set; }
    
    public int UserCurrentPage { get; set; }
    public int UserTotalPages { get; set; }
    public int UserTotalRecords { get; set; }
    public int UserProcessedRecords { get; set; }
    public int UserNewRecords { get; set; }
    public int UserUpdatedRecords { get; set; }
    public int UserFailedRecords { get; set; }
    
    public int NasCurrentPage { get; set; }
    public int NasTotalPages { get; set; }
    public int NasTotalRecords { get; set; }
    public int NasProcessedRecords { get; set; }
    public int NasNewRecords { get; set; }
    public int NasUpdatedRecords { get; set; }
    public int NasFailedRecords { get; set; }
    
    public double ProgressPercentage { get; set; }
    public string? CurrentMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime Timestamp { get; set; }
}


