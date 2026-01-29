using Backend.Models;

namespace Backend.Services;

public interface ISessionSyncService
{
    Task<Guid> StartSessionSyncAsync(int integrationId, int workspaceId);
    Task<SessionSyncProgress?> GetSyncProgressAsync(Guid syncId);
    Task<List<SessionSyncLog>> GetSyncLogsAsync(int integrationId, int workspaceId);
    Task<bool> CancelSyncAsync(Guid syncId);
}
