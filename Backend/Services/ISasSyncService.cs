namespace Backend.Services;

public interface ISasSyncService
{
    Task<Guid> SyncAsync(int integrationId, bool fullSync = false);
    Task<bool> CancelSyncAsync(Guid syncId);
    Task<ManagerSyncResult> SyncManagersAsync(int integrationId);
}

public class ManagerSyncResult
{
    public int TotalManagers { get; set; }
    public int NewUsersCreated { get; set; }
    public int ExistingUsersUpdated { get; set; }
    public int KeycloakUsersCreated { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = new();
}


