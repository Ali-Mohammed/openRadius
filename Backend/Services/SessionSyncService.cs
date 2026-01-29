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

    public async Task<Guid> StartSessionSyncAsync(int integrationId, int workspaceId)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            
            // Check for active syncs (status < 5 means not completed/failed/cancelled)
            var activeSync = await context.SessionSyncProgresses
                .Where(s => s.Status < SessionSyncStatus.Completed)
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();

            if (activeSync != null)
            {
                throw new InvalidOperationException(
                    $"Cannot start session sync: Another session sync is already in progress for '{activeSync.IntegrationName}' " +
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
                WorkspaceId = workspaceId,
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
                    await ExecuteSessionSyncAsync(syncId, integration, workspaceId, cts.Token);
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

    private async Task ExecuteSessionSyncAsync(Guid syncId, SasRadiusIntegration integration, int workspaceId, CancellationToken cancellationToken)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            // Get configuration to build workspace-specific connection string
            var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            
            // Create ApplicationDbContext with the correct workspace connection string
            // (the scoped context won't have tenant info since we're in a background task)
            var baseConnectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
            var workspaceConnectionString = baseConnectionString.Replace(
                GetDatabaseNameFromConnectionString(baseConnectionString), 
                $"openradius_workspace_{workspaceId}"
            );
            
            _logger.LogInformation($"ExecuteSessionSyncAsync: Creating ApplicationDbContext for workspace {workspaceId} with connection: {workspaceConnectionString}");
            
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(workspaceConnectionString);
            using var context = new ApplicationDbContext(optionsBuilder.Options);
            
            var startTime = DateTime.UtcNow;

            try
            {
                await UpdateProgressAsync(syncId, SessionSyncStatus.Authenticating, 5, "Authenticating with SAS4...");

                // Get auth token (using same method as SasSyncService)
                var authToken = await AuthenticateAsync(integration, cancellationToken);

                if (string.IsNullOrEmpty(authToken))
                {
                    throw new Exception("Failed to authenticate with SAS4");
                }

                await UpdateProgressAsync(syncId, SessionSyncStatus.FetchingOnlineUsers, 20, "Fetching online sessions from SAS4...");

                // Fetch sessions from SAS4 API with pagination
                var recordsPerPage = integration.SessionSyncRecordsPerPage > 0 ? integration.SessionSyncRecordsPerPage : 500;
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authToken);
                
                // Construct URL using same pattern as SasSyncService
                var baseUrlRaw = integration.Url?.Trim().TrimEnd('/') ?? string.Empty;
                
                // Add protocol if not present
                if (!baseUrlRaw.StartsWith("http://") && !baseUrlRaw.StartsWith("https://"))
                {
                    var protocol = integration.UseHttps ? "https" : "http";
                    baseUrlRaw = $"{protocol}://{baseUrlRaw}";
                }
                
                var uri = new Uri(baseUrlRaw);
                var baseUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/UserSessions";

                int currentPage = 1;
                int totalSessions = 0;
                int totalPages = 0;
                int successCount = 0;
                int failureCount = 0;
                int processedCount = 0;
                int newSessionsCount = 0;
                int updatedSessionsCount = 0;

                // Fetch first page to get total count and pages
                var firstPageResponse = await FetchSessionPageAsync(client, baseUrl, currentPage, recordsPerPage, cancellationToken);
                
                if (firstPageResponse == null)
                {
                    throw new Exception("Failed to fetch sessions from SAS4 API");
                }

                totalSessions = firstPageResponse.Total;
                totalPages = firstPageResponse.LastPage;
                
                await UpdateProgressAsync(syncId, SessionSyncStatus.ProcessingUsers, 30, 
                    $"Found {totalSessions} online sessions across {totalPages} pages. Starting sync...");

                // Update total users
                var progress = await context.SessionSyncProgresses.FindAsync(syncId);
                if (progress != null)
                {
                    progress.TotalOnlineUsers = totalSessions;
                    await context.SaveChangesAsync();
                }

                // Process first page
                if (firstPageResponse.Data != null && firstPageResponse.Data.Count > 0)
                {
                    foreach (var session in firstPageResponse.Data)
                    {
                        if (cancellationToken.IsCancellationRequested)
                        {
                            await UpdateProgressAsync(syncId, SessionSyncStatus.Cancelled, progress?.ProgressPercentage ?? 0, "Sync cancelled by user");
                            return;
                        }

                        try
                        {
                            // Save or update session in radacct table
                            bool isNew = await UpsertRadiusAccountingAsync(context, session);
                            if (isNew)
                                newSessionsCount++;
                            else
                                updatedSessionsCount++;
                            successCount++;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to process session for user {Username}, RadAcctId {RadAcctId}", 
                                session.Username, session.RadAcctId);
                            failureCount++;
                        }

                        processedCount++;
                    }
                }

                // Fetch remaining pages
                for (int page = 2; page <= totalPages; page++)
                {
                    if (cancellationToken.IsCancellationRequested)
                    {
                        await UpdateProgressAsync(syncId, SessionSyncStatus.Cancelled, progress?.ProgressPercentage ?? 0, "Sync cancelled by user");
                        return;
                    }

                    currentPage = page;
                    var pageResponse = await FetchSessionPageAsync(client, baseUrl, currentPage, recordsPerPage, cancellationToken);
                    
                    if (pageResponse?.Data == null) continue;

                    foreach (var session in pageResponse.Data)
                    {
                        if (cancellationToken.IsCancellationRequested)
                        {
                            await UpdateProgressAsync(syncId, SessionSyncStatus.Cancelled, progress?.ProgressPercentage ?? 0, "Sync cancelled by user");
                            return;
                        }

                        try
                        {
                            // Save or update session in radacct table
                            bool isNew = await UpsertRadiusAccountingAsync(context, session);
                            if (isNew)
                                newSessionsCount++;
                            else
                                updatedSessionsCount++;
                            successCount++;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to process session for user {Username}, RadAcctId {RadAcctId}", 
                                session.Username, session.RadAcctId);
                            failureCount++;
                        }

                        processedCount++;
                    }

                    // Calculate progress (30% to 90% for processing)
                    var currentProgress = 30 + (int)((currentPage / (double)totalPages) * 60);
                    
                    await UpdateProgressAsync(
                        syncId,
                        SessionSyncStatus.SyncingToSas, 
                        currentProgress, 
                        $"Processing page {currentPage}/{totalPages} - {processedCount}/{totalSessions} sessions");

                    // Update detailed progress
                    var currentProgress2 = await context.SessionSyncProgresses.FindAsync(syncId);
                    if (currentProgress2 != null)
                    {
                        currentProgress2.ProcessedUsers = processedCount;
                        currentProgress2.SuccessfulSyncs = successCount;
                        currentProgress2.FailedSyncs = failureCount;
                        currentProgress2.NewSessions = newSessionsCount;
                        currentProgress2.UpdatedSessions = updatedSessionsCount;
                        await context.SaveChangesAsync();
                    }

                    // Broadcast progress via SignalR (consistent with SasSyncService pattern)
                    await _hubContext.Clients.All.SendAsync("SessionSyncProgress", new
                    {
                        SyncId = syncId,
                        IntegrationId = integration.Id,
                        Status = SessionSyncStatus.SyncingToSas,
                        ProgressPercentage = currentProgress,
                        TotalUsers = totalSessions,
                        ProcessedCount = processedCount,
                        SuccessCount = successCount,
                        FailureCount = failureCount,
                        NewSessions = newSessionsCount,
                        UpdatedSessions = updatedSessionsCount,
                        CurrentMessage = $"Processing page {currentPage}/{totalPages} - {processedCount}/{totalSessions} sessions",
                        Timestamp = DateTime.UtcNow
                    });
                }

                var endTime = DateTime.UtcNow;
                var duration = (int)(endTime - startTime).TotalSeconds;
                
                _logger.LogInformation("Session sync completed: SyncId={SyncId}, IntegrationId={IntegrationId}, WorkspaceId={WorkspaceId}, Status={Status}, TotalUsers={TotalUsers}", 
                    syncId, integration.Id, workspaceId, SessionSyncStatus.Completed, totalSessions);

                await UpdateProgressAsync(syncId, SessionSyncStatus.Completed, 100, 
                    $"Session sync completed! Processed {successCount} sessions, {failureCount} failed.", true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Session sync failed for integration {IntegrationId}", integration.Id);
                
                var endTime = DateTime.UtcNow;
                var duration = (int)(endTime - startTime).TotalSeconds;

                await UpdateProgressAsync(syncId, SessionSyncStatus.Failed, 0, $"Sync failed: {ex.Message}", true);
            }
        }
    }

    private async Task<string> AuthenticateAsync(SasRadiusIntegration integration, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var baseUrl = integration.Url?.Trim().TrimEnd('/') ?? string.Empty;
        
        _logger.LogInformation("Original URL from integration: '{Url}', UseHttps: {UseHttps}", integration.Url, integration.UseHttps);
        
        // Validate URL
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new Exception("Integration URL is empty or null. Please configure the SAS integration URL.");
        }
        
        // Add protocol if not present
        if (!baseUrl.StartsWith("http://") && !baseUrl.StartsWith("https://"))
        {
            var protocol = integration.UseHttps ? "https" : "http";
            baseUrl = $"{protocol}://{baseUrl}";
        }
        
        _logger.LogInformation("Final URL after protocol check: '{BaseUrl}'", baseUrl);
        
        // Construct the login URL with SAS API path (same as SasSyncService)
        var uri = new Uri(baseUrl);
        var loginUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/login";
        
        _logger.LogInformation("Authenticating to SAS API at: {LoginUrl}", loginUrl);
        
        // Prepare login credentials (use plain password, not encrypted from DB)
        var loginData = new { username = integration.Username, password = integration.Password };
        var loginJson = JsonSerializer.Serialize(loginData);
        
        // Encrypt the entire JSON payload using AES (SAS API requirement)
        var encryptedPayload = EncryptionHelper.EncryptAES(loginJson, AES_KEY);
        
        // Send request with encrypted payload
        var requestBody = new { payload = encryptedPayload };
        var response = await client.PostAsJsonAsync(loginUrl, requestBody, cancellationToken);
        
        // Log response for debugging
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("SAS API login failed with {StatusCode}: {Error}", response.StatusCode, errorBody);
        }
        
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
        var token = result.GetProperty("token").GetString();
        
        if (string.IsNullOrEmpty(token))
        {
            throw new Exception("No token received from SAS API");
        }
        
        _logger.LogInformation("Successfully authenticated to SAS API");
        return token;
    }

    private async Task<SessionPageResponse?> FetchSessionPageAsync(HttpClient client, string baseUrl, int page, int perPage, CancellationToken cancellationToken)
    {
        try
        {
            // Prepare request payload
            var requestData = new
            {
                page,
                count = perPage,
                sortBy = "acctstarttime",
                direction = "desc",
                search = "",
                columns = new[] { "username", "acctstarttime", "acctstoptime", "framedipaddress", "nasipaddress", 
                                 "callingstationid", "framedprotocol", "acctinputoctets", "acctoutputoctets", 
                                 "calledstationid", "nasportid", "acctterminatecause" }
            };

            // Encrypt payload using AES (SAS API requirement)
            var requestJson = JsonSerializer.Serialize(requestData);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };

            // Send encrypted payload
            var response = await client.PostAsJsonAsync(baseUrl, requestBody, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to fetch sessions page {Page}: {StatusCode}", page, response.StatusCode);
                return null;
            }

            var sessionResponse = await response.Content.ReadFromJsonAsync<SessionPageResponse>(cancellationToken: cancellationToken);
            return sessionResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sessions page {Page}", page);
            return null;
        }
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
        using var scope = _scopeFactory.CreateScope();
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
                SyncId = syncId,
                IntegrationId = progress.IntegrationId,
                Status = status,
                ProgressPercentage = progressPercentage,
                CurrentMessage = message,
                TotalUsers = progress.TotalOnlineUsers,
                ProcessedCount = progress.ProcessedUsers,
                SuccessCount = progress.SuccessfulSyncs,
                FailureCount = progress.FailedSyncs,
                IsCompleted = isCompleted,
                Timestamp = DateTime.UtcNow
            });
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

    public async Task<List<SessionSyncProgress>> GetSyncLogsAsync(int integrationId, int workspaceId)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var logs = await context.SessionSyncProgresses
            .Where(l => l.IntegrationId == integrationId && l.WorkspaceId == workspaceId)
            .OrderByDescending(l => l.StartedAt)
            .ToListAsync();

        return logs;
    }

    public async Task<bool> CancelSyncAsync(Guid syncId)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var sync = await context.SessionSyncProgresses
            .FirstOrDefaultAsync(s => s.SyncId == syncId);
        
        if (sync == null)
        {
            return false;
        }
        
        // Check if sync is already completed, failed, or cancelled
        if (sync.Status == SessionSyncStatus.Completed || sync.Status == SessionSyncStatus.Failed || sync.Status == SessionSyncStatus.Cancelled)
        {
            return false;
        }
        
        // Try to cancel the background task if it's still running
        if (_activeSyncs.TryGetValue(syncId, out var cts))
        {
            cts.Cancel();
        }
        
        // Update sync status regardless of whether task was in dictionary
        sync.Status = SessionSyncStatus.Cancelled;
        sync.CurrentMessage = "Sync cancelled by user";
        sync.CompletedAt = DateTime.UtcNow;
        sync.LastUpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        
        // Broadcast cancellation via SignalR
        await _hubContext.Clients.All.SendAsync("SessionSyncProgress", new
        {
            SyncId = syncId,
            IntegrationId = sync.IntegrationId,
            Status = SessionSyncStatus.Cancelled,
            ProgressPercentage = sync.ProgressPercentage,
            CurrentMessage = "Sync cancelled by user",
            IsCompleted = true,
            Timestamp = DateTime.UtcNow
        });
        
        return true;
    }
    
    private async Task<bool> UpsertRadiusAccountingAsync(ApplicationDbContext context, SessionData session)
    {
        // Check if session already exists
        var existing = await context.RadiusAccounting
            .FirstOrDefaultAsync(r => r.RadAcctId == session.RadAcctId);

        bool isNewSession = existing == null;

        if (existing != null)
        {
            // Update existing session
            existing.AcctStopTime = ParseDateTime(session.AcctStopTime);
            existing.AcctOutputOctets = session.AcctOutputOctets;
            existing.AcctInputOctets = session.AcctInputOctets;
            existing.AcctTerminateCause = session.AcctTerminateCause;
            
            // Calculate session time if stopped
            if (existing.AcctStopTime.HasValue && existing.AcctStartTime.HasValue)
            {
                existing.AcctSessionTime = (long)(existing.AcctStopTime.Value - existing.AcctStartTime.Value).TotalSeconds;
            }
        }
        else
        {
            // Create new session
            var newSession = new RadiusAccounting
            {
                RadAcctId = session.RadAcctId,
                UserName = session.Username,
                NasIpAddress = session.NasIpAddress,
                AcctStartTime = ParseDateTime(session.AcctStartTime),
                AcctStopTime = ParseDateTime(session.AcctStopTime),
                FramedIpAddress = session.FramedIpAddress,
                AcctOutputOctets = session.AcctOutputOctets,
                AcctInputOctets = session.AcctInputOctets,
                CallingStationId = session.CallingStationId,
                CalledStationId = session.CalledStationId,
                AcctTerminateCause = session.AcctTerminateCause
            };
            
            // Calculate session time if stopped
            if (newSession.AcctStopTime.HasValue && newSession.AcctStartTime.HasValue)
            {
                newSession.AcctSessionTime = (long)(newSession.AcctStopTime.Value - newSession.AcctStartTime.Value).TotalSeconds;
            }
            
            await context.RadiusAccounting.AddAsync(newSession);
        }
        
        await context.SaveChangesAsync();
        return isNewSession;
    }
    
    private DateTime? ParseDateTime(string? dateTimeString)
    {
        if (string.IsNullOrEmpty(dateTimeString))
            return null;
            
        if (DateTime.TryParse(dateTimeString, out var result))
        {
            // PostgreSQL requires DateTime with Kind=UTC for timestamp with time zone
            // If the parsed datetime is Unspecified, treat it as UTC
            if (result.Kind == DateTimeKind.Unspecified)
            {
                return DateTime.SpecifyKind(result, DateTimeKind.Utc);
            }
            // If it's Local, convert to UTC
            else if (result.Kind == DateTimeKind.Local)
            {
                return result.ToUniversalTime();
            }
            // Already UTC
            return result;
        }
            
        return null;
    }
    
    private static string GetDatabaseNameFromConnectionString(string connectionString)
    {
        var parts = connectionString.Split(';');
        foreach (var part in parts)
        {
            if (part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase))
            {
                return part.Split('=')[1].Trim();
            }
        }
        return "openradius";
    }
}

// Response models for SAS4 UserSessions API
public class SessionPageResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("current_page")]
    public int CurrentPage { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("data")]
    public List<SessionData> Data { get; set; } = new();
    
    [System.Text.Json.Serialization.JsonPropertyName("first_page_url")]
    public string? FirstPageUrl { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("from")]
    public int From { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("last_page")]
    public int LastPage { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("last_page_url")]
    public string? LastPageUrl { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("next_page_url")]
    public string? NextPageUrl { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("path")]
    public string? Path { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("per_page")]
    public int PerPage { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("prev_page_url")]
    public string? PrevPageUrl { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("to")]
    public int To { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("total")]
    public int Total { get; set; }
}

public class SessionData
{
    [System.Text.Json.Serialization.JsonPropertyName("radacctid")]
    public long RadAcctId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("username")]
    public string? Username { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("nasipaddress")]
    public string? NasIpAddress { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("acctstarttime")]
    public string? AcctStartTime { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("acctstoptime")]
    public string? AcctStopTime { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("framedipaddress")]
    public string? FramedIpAddress { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("acctoutputoctets")]
    public long AcctOutputOctets { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("acctinputoctets")]
    public long AcctInputOctets { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("callingstationid")]
    public string? CallingStationId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("profile_id")]
    public int? ProfileId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("calledstationid")]
    public string? CalledStationId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("acctterminatecause")]
    public string? AcctTerminateCause { get; set; }
}
