namespace Backend.Services;

public interface ISasSyncService
{
    Task<Guid> SyncAsync(int integrationId, int instantId, bool fullSync = false);
    Task<bool> CancelSyncAsync(Guid syncId, int instantId);
}
