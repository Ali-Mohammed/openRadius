using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Backend.Data;
using Backend.Helpers;
using Backend.Hubs;
using Backend.Models;

namespace Backend.Services;

public class SessionSyncService : ISessionSyncService
{
    private const string AES_KEY = "abcdefghijuklmno0123456789012345";
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<SasSyncHub> _hubContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SessionSyncService> _logger;
    private static readonly ConcurrentDictionary<Guid, CancellationTokenSource> _activeSyncs = new();

    public SessionSyncService(
        IServiceScopeFactory scopeFactory,
        IHubContext<SasSyncHub> hubContext,
        IHttpClientFactory httpClientFactory,
        ILogger<SessionSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<Guid> StartSessionSyncAsync(int integrationId)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            
            // Check for active syncs (status < 5 means not completed/failed/cancelled)
            var activeSync = await context.SessionSyncProgresses
                .Where(s => s.IntegrationId == integrationId && s.Status < SessionSyncStatus.Completed)
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();

            if (activeSync != null)
            {
                throw new InvalidOperationException(
                    $"Cannot start session sync: Another session sync is already in progress " +
                    $"(Status: {activeSync.Status}, Progress: {activeSync.ProgressPercentage:F0}%). " +
                    $"Please wait for it to complete or cancel it first.");
            }

            // Get integration settings
            var integration = await context.SasRadiusIntegrations
                .FirstOrDefaultAsync(i => i.Id == integrationId);

            if (integration == null)
            {
                throw new InvalidOperationException($"Integration {integrationId} not found");
            }

            if (!integration.SyncOnlineUsers)
            {
                throw new InvalidOperationException("Session sync is not enabled for this integration");
            }

            var syncId = Guid.NewGuid();

            // Create sync progress record
            var syncProgress = new SessionSyncProgress
            {
                SyncId = syncId,
                IntegrationId = integrationId,
                IntegrationName = integration.Name,
                WorkspaceId = 1, // TODO: Get from context
                Status = SessionSyncStatus.Starting,
                ProgressPercentage = 0,
                StartedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            };

            await context.SessionSyncProgresses.AddAsync(syncProgress);
            await context.SaveChangesAsync();

            // Create cancellation token for this sync
            var cts = new CancellationTokenSource();
            _activeSyncs[syncId] = cts;

            // Start sync in background
            _ = Task.Run(async () => 
            {
                try
                {
                    await ExecuteSessionSyncAsync(syncId, integration, cts.Token);
                }
                finally
                {
                    _activeSyncs.TryRemove(syncId, out _);
                    cts.Dispose();
                }
            });

            return syncId;
        }
    }

    private async Task ExecuteSessionSyncAsync(Guid syncId, SasRadiusIntegration integration, CancellationToken cancellationToken)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var startTime = DateTime.UtcNow;

            try
            {
                await UpdateProgressAsync(syncId, SessionSyncStatus.Authenticating, 5, "Authenticating with SAS4...");

                // Decrypt credentials
                var username = EncryptionHelper.DecryptAES(integration.Username, AES_KEY);
                var password = EncryptionHelper.DecryptAES(integration.Password, AES_KEY);

                // Get auth token
                var authToken = await AuthenticateAsync(integration.Url, username, password, integration.UseHttps, cancellationToken);

                if (string.IsNullOrEmpty(authToken))
                {
                    throw new Exception("Failed to authenticate with SAS4");
                }

                await UpdateProgressAsync(syncId, SessionSyncStatus.FetchingOnlineUsers, 20, "Fetching online users from RADIUS...");

                // Get online users from RADIUS database (limit by SessionSyncRecordsPerPage)
                var recordsPerPage = integration.SessionSyncRecordsPerPage > 0 ? integration.SessionSyncRecordsPerPage : 500;
                var onlineUsers = await context.RadiusUsers
                    .Where(u => u.OnlineStatus == 1) // 1 = Online
                    .Take(recordsPerPage) // Limit records per sync
                    .Select(u => new
                    {
                        u.Username,
                        u.LastOnline,
                        u.Id
                    })
                    .ToListAsync(cancellationToken);

                var totalUsers = onlineUsers.Count;
                await UpdateProgressAsync(syncId, SessionSyncStatus.ProcessingUsers, 40, $"Found {totalUsers} online users. Starting sync...");

                // Update total users
                var progress = await context.SessionSyncProgresses.FindAsync(syncId);
                if (progress != null)
                {
                    progress.TotalOnlineUsers = totalUsers;
                    await context.SaveChangesAsync();
                }

                int successCount = 0;
                int failureCount = 0;
                int processedCount = 0;

                // Sync each user to SAS4
                foreach (var user in onlineUsers)
                {
                    if (cancellationToken.IsCancellationRequested)
                    {
                        await UpdateProgressAsync(syncId, SessionSyncStatus.Cancelled, progress?.ProgressPercentage ?? 0, "Sync cancelled by user");
                        return;
                    }

                    try
                    {
                        // Send session data to SAS4
                        await SyncUserSessionToSasAsync(integration, authToken, user.Username, user.LastOnline, cancellationToken);
                        successCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to sync session for user {Username}", user.Username);
                        failureCount++;
                    }

                    processedCount++;
                    var currentProgress = 40 + (int)((processedCount / (double)totalUsers) * 50);
                    
                    await UpdateProgressAsync(
                        syncId, 
                        SessionSyncStatus.SyncingToSas, 
                        currentProgress, 
                        $"Syncing users... ({processedCount}/{totalUsers})");

                    // Update detailed progress
                    var currentProgress2 = await context.SessionSyncProgresses.FindAsync(syncId);
                    if (currentProgress2 != null)
                    {
                        currentProgress2.ProcessedUsers = processedCount;
                        currentProgress2.SuccessfulSyncs = successCount;
                        currentProgress2.FailedSyncs = failureCount;
                        await context.SaveChangesAsync();
                    }

                    // Broadcast progress via SignalR
                    await _hubContext.Clients.All.SendAsync("SessionSyncProgress", new
                    {
                        syncId,
                        integrationId = integration.Id,
                        status = SessionSyncStatus.SyncingToSas,
                        progressPercentage = currentProgress,
                        totalUsers,
                        processedCount,
                        successCount,
                        failureCount,
                        currentMessage = $"Syncing users... ({processedCount}/{totalUsers})"
                    });
                }

                var endTime = DateTime.UtcNow;
                var duration = (int)(endTime - startTime).TotalSeconds;

                // Create log entry
                var log = new SessionSyncLog
                {
                    SyncId = syncId,
                    IntegrationId = integration.Id,
                    WorkspaceId = 1, // TODO: Get from context
                    Timestamp = startTime,
                    Status = SessionSyncStatus.Completed,
                    TotalUsers = totalUsers,
                    SyncedUsers = successCount,
                    FailedUsers = failureCount,
                    DurationSeconds = duration,
                    CreatedAt = DateTime.UtcNow
                };

                await context.SessionSyncLogs.AddAsync(log);
                await context.SaveChangesAsync();

                await UpdateProgressAsync(syncId, SessionSyncStatus.Completed, 100, 
                    $"Session sync completed! Synced {successCount} users, {failureCount} failed.", true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Session sync failed for integration {IntegrationId}", integration.Id);
                
                var endTime = DateTime.UtcNow;
                var duration = (int)(endTime - startTime).TotalSeconds;

                // Get current progress for stats
                var currentStats = await context.SessionSyncProgresses.FindAsync(syncId);
                
                // Create log entry for failed sync
                var log = new SessionSyncLog
                {
                    SyncId = syncId,
                    IntegrationId = integration.Id,
                    WorkspaceId = 1,
                    Timestamp = startTime,
                    Status = SessionSyncStatus.Failed,
                    TotalUsers = currentStats?.TotalOnlineUsers ?? 0,
                    SyncedUsers = currentStats?.SuccessfulSyncs ?? 0,
                    FailedUsers = currentStats?.FailedSyncs ?? 0,
                    DurationSeconds = duration,
                    ErrorMessage = ex.Message,
                    CreatedAt = DateTime.UtcNow
                };

                await context.SessionSyncLogs.AddAsync(log);
                await context.SaveChangesAsync();

                await UpdateProgressAsync(syncId, SessionSyncStatus.Failed, 0, $"Sync failed: {ex.Message}", true);
            }
        }
    }

    private async Task<string> AuthenticateAsync(string baseUrl, string username, string password, bool useHttps, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var protocol = useHttps ? "https" : "http";
        var url = $"{protocol}://{baseUrl}/api/manager/sign-in";

        var requestData = new
        {
            username,
            password
        };

        var content = new StringContent(JsonSerializer.Serialize(requestData), Encoding.UTF8, "application/json");
        var response = await client.PostAsync(url, content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"Authentication failed: {response.StatusCode}");
        }

        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        var jsonDoc = JsonDocument.Parse(responseContent);
        
        if (jsonDoc.RootElement.TryGetProperty("data", out var dataElement) &&
            dataElement.TryGetProperty("authkey", out var authKeyElement))
        {
            return authKeyElement.GetString() ?? string.Empty;
        }

        throw new Exception("Failed to extract auth token from response");
    }

    private async Task SyncUserSessionToSasAsync(SasRadiusIntegration integration, string authToken, string username, DateTime? lastOnline, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var protocol = integration.UseHttps ? "https" : "http";
        var url = $"{protocol}://{integration.Url}/api/online-users/sync";

        var requestData = new
        {
            username,
            lastOnline = lastOnline?.ToString("yyyy-MM-dd HH:mm:ss"),
            status = "online"
        };

        var content = new StringContent(JsonSerializer.Serialize(requestData), Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authToken);

        var response = await client.PostAsync(url, content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new Exception($"Failed to sync session for {username}: {response.StatusCode} - {errorContent}");
        }
    }

    private async Task UpdateProgressAsync(Guid syncId, SessionSyncStatus status, double progressPercentage, string message, bool isCompleted = false)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var progress = await context.SessionSyncProgresses.FindAsync(syncId);

            if (progress != null)
            {
                progress.Status = status;
                progress.ProgressPercentage = progressPercentage;
                progress.CurrentMessage = message;
                progress.LastUpdatedAt = DateTime.UtcNow;

                if (isCompleted)
                {
                    progress.CompletedAt = DateTime.UtcNow;
                }

                await context.SaveChangesAsync();

                // Broadcast via SignalR
                await _hubContext.Clients.All.SendAsync("SessionSyncProgress", new
                {
                    syncId,
                    integrationId = progress.IntegrationId,
                    status,
                    progressPercentage,
                    currentMessage = message,
                    isCompleted
                });
            }
        }
    }

    public async Task<SessionSyncProgress?> GetSyncProgressAsync(Guid syncId)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return await context.SessionSyncProgresses.FindAsync(syncId);
        }
    }

    public async Task<List<SessionSyncLog>> GetSyncLogsAsync(int integrationId, int workspaceId)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return await context.SessionSyncLogs
                .Where(l => l.IntegrationId == integrationId && l.WorkspaceId == workspaceId)
                .OrderByDescending(l => l.Timestamp)
                .Take(100)
                .ToListAsync();
        }
    }

    public async Task CancelSyncAsync(Guid syncId)
    {
        if (_activeSyncs.TryGetValue(syncId, out var cts))
        {
            cts.Cancel();
        }

        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var progress = await context.SessionSyncProgresses.FindAsync(syncId);

            if (progress != null)
            {
                progress.Status = SessionSyncStatus.Cancelled;
                progress.CurrentMessage = "Cancelled by user";
                progress.CompletedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();
            }
        }
    }
}
