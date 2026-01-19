namespace Backend.Services;

public interface ISasSyncService
{
    Task<Guid> SyncAsync(int integrationId, bool fullSync = false);
    Task<bool> CancelSyncAsync(Guid syncId);
    Task<ManagerSyncResult> SyncManagersAsync(int integrationId, int workspaceId, Action<ManagerSyncProgress>? onProgress = null);
}

public class ManagerSyncResult
{
    public int TotalManagers { get; set; }
    public int NewUsersCreated { get; set; }
    public int ExistingUsersUpdated { get; set; }
    public int KeycloakUsersCreated { get; set; }
    public int WalletsCreated { get; set; }
    public int WorkspacesAssigned { get; set; }
    public int ZonesAssigned { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class ManagerSyncProgress
{
    public string Phase { get; set; } = "";
    public int Current { get; set; }
    public int Total { get; set; }
    public int PercentComplete { get; set; }
    public string Message { get; set; } = "";
}


