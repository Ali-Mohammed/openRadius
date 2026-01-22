namespace Backend.Services;

public interface IRadiusTagSyncService
{
    Task<TagSyncResult> SyncTagsAsync(string? filters = null, Action<TagSyncProgress>? onProgress = null);
    Task<TagSyncResult> SyncTagsWithRulesAsync(int workspaceId, Action<TagSyncProgress>? onProgress = null);
}

public class TagSyncResult
{
    public int TotalUsers { get; set; }
    public int UsersProcessed { get; set; }
    public int TagsAssigned { get; set; }
    public int TagsRemoved { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class TagSyncProgress
{
    public string Phase { get; set; } = "";
    public int Current { get; set; }
    public int Total { get; set; }
    public int PercentComplete { get; set; }
    public string Message { get; set; } = "";
}
