namespace Backend.Services;

public interface ISasSyncService
{
    Task<Guid> SyncAsync(int integrationId, int WorkspaceId, bool fullSync = false);
    Task<bool> CancelSyncAsync(Guid syncId, int WorkspaceId);
}


