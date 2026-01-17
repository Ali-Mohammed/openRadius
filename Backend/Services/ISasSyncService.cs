namespace Backend.Services;

public interface ISasSyncService
{
    Task<Guid> SyncAsync(int integrationId, bool fullSync = false);
    Task<bool> CancelSyncAsync(Guid syncId);
}


