using Backend.Data;
using Backend.Models;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Backend.Helpers;
using System.Text.Json;

namespace Backend.Services;

public interface ISasActivationService
{
    Task<string> EnqueueActivationAsync(int integrationId, string integrationName, int userId, string username, object activationData, int priority = 0);
    Task<List<string>> EnqueueBatchActivationsAsync(int integrationId, string integrationName, List<(int userId, string username, object data)> activations);
    Task ProcessActivationAsync(int logId, int workspaceId, string connectionString);
    Task<int> RetryFailedActivationsAsync(int integrationId, DateTime? fromDate = null);
    Task<bool> RetrySingleActivationAsync(int logId);
    Task<int> GetRetryableCountAsync(int integrationId, DateTime? fromDate = null);
    Task<List<SasActivationLog>> GetActivationLogsAsync(int integrationId, int page = 1, int pageSize = 50, string? search = null);
    Task<SasActivationLog?> GetActivationLogAsync(int logId);
    Task<ActivationMetrics> GetMetricsAsync(int integrationId, DateTime? fromDate = null);
    Task<bool> IsIntegrationHealthyAsync(int integrationId);
    Task<(bool available, string? errorMessage)> CheckCardAvailabilityAsync(int integrationId, int radiusProfileId);
}

public class SasActivationService : ISasActivationService
{
    private const string AES_KEY = "abcdefghijuklmno0123456789012345";
    
    private readonly ApplicationDbContext _context;
    private readonly IWorkspaceJobService _jobService;
    private readonly ILogger<SasActivationService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;
    
    // Token cache to avoid re-authenticating for every API call
    // Key format: "workspaceId:integrationId" to support multi-tenant scenarios
    private static readonly Dictionary<string, (string token, DateTime expiresAt)> _tokenCache = new();
    private static readonly SemaphoreSlim _tokenCacheLock = new(1, 1);
    
    public SasActivationService(
        ApplicationDbContext context,
        IWorkspaceJobService jobService,
        ILogger<SasActivationService> logger,
        IHttpClientFactory httpClientFactory,
        IMultiTenantContextAccessor<WorkspaceTenantInfo> tenantAccessor)
    {
        _context = context;
        _jobService = jobService;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _tenantAccessor = tenantAccessor;
    }
    
    /// <summary>
    /// Enqueue a new activation to be sent to SAS4
    /// </summary>
    public async Task<string> EnqueueActivationAsync(int integrationId, string integrationName, int userId, string username, object activationData, int priority = 0)
    {
        // Idempotency check - prevent duplicate pending activations for same user/integration
        var existingPending = await _context.SasActivationLogs
            .AnyAsync(l => l.IntegrationId == integrationId 
                        && l.UserId == userId 
                        && (l.Status == ActivationStatus.Pending || l.Status == ActivationStatus.Processing));
        
        if (existingPending)
        {
            _logger.LogWarning($"[SAS_Activation_005] Duplicate activation prevented for user {username} (ID: {userId}) via integration {integrationName}");
            return "duplicate-prevented";
        }
        
        // Get integration settings for queue configuration
        var integration = await _context.SasRadiusIntegrations
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == integrationId);
        
        if (integration == null)
        {
            throw new ArgumentException($"Integration {integrationId} not found");
        }
        
        if (!integration.SendActivationsToSas)
        {
            _logger.LogInformation($"[SAS_Activation_006] Activation skipped - SendActivationsToSas is disabled for integration {integrationName}");
            return "disabled";
        }
        
        var log = new SasActivationLog
        {
            IntegrationId = integrationId,
            IntegrationName = integrationName,
            UserId = userId,
            Username = username,
            ActivationData = System.Text.Json.JsonSerializer.Serialize(activationData),
            Status = ActivationStatus.Pending,
            RetryCount = 0,
            MaxRetries = integration.ActivationMaxRetries,
            CreatedAt = DateTime.UtcNow
        };
        
         _logger.LogInformation("[SAS_Activation_001] integration.ActivationMethod: {ActivationMethod}", integration.ActivationMethod);

        // If activation method is PrepaidCard, fetch PIN from card inventory
        if (integration.ActivationMethod == "PrepaidCard")
        {

            _logger.LogInformation("[SAS_Activation_002] Fetching prepaid card PIN for activation");

            try
            {
                // Parse activation data to get profile ID
                var activationDataJson = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(
                    System.Text.Json.JsonSerializer.Serialize(activationData));
                
                if (activationDataJson != null && activationDataJson.TryGetValue("radiusProfileId", out var profileIdElement))
                {
                    var radiusProfileId = profileIdElement.GetInt32();
                    
                    // Get the radius profile to fetch its ExternalId (SAS4 profile ID)
                    var radiusProfile = await _context.RadiusProfiles
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == radiusProfileId);
                    
                    if (radiusProfile == null)
                    {
                        throw new InvalidOperationException($"Radius profile {radiusProfileId} not found");
                    }
                    
                    if (radiusProfile.ExternalId == 0)
                    {
                        throw new InvalidOperationException($"Radius profile '{radiusProfile.Name}' does not have an ExternalId (SAS4 profile ID). Please sync profiles first.");
                    }
                    
                    // Fetch PIN from card inventory
                    var (pin, series, serialNumber) = await GetPrepaidCardPinAsync(integration, radiusProfile.ExternalId, _context);
                    
                    if (pin == null)
                    {
                        _logger.LogWarning(
                            $"[SAS_Activation_003] No available prepaid cards found for profile '{radiusProfile.Name}' (ID: {radiusProfile.ExternalId}). " +
                            "Activation will proceed but will likely fail without a PIN.");
                    }
                    else
                    {
                        // Store PIN information in the log
                        log.Pin = pin;
                        log.CardSeries = series;
                        log.CardSerialNumber = serialNumber;
                    }
                    
                    _logger.LogInformation(
                        $"[SAS_Activation_004] Retrieved PIN {pin} from series {series} (serial: {serialNumber}) for user {username} activation");
                }
                else
                {
                    throw new InvalidOperationException("Activation data does not contain radiusProfileId");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[SAS_Activation_057] Failed to retrieve prepaid card PIN for user {username}");
                throw; // Fail the activation if we can't get a PIN
            }
        }
        
        _context.SasActivationLogs.Add(log);
        await _context.SaveChangesAsync();
        
        // Get workspace info for job execution
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo?.ConnectionString == null)
        {
            throw new InvalidOperationException("No tenant context or connection string available");
        }
        
        // Enqueue Hangfire job with integration-specific queue for concurrency control
        var connectionString = tenantInfo.ConnectionString;
        var queueName = _jobService.GetIntegrationQueue(integrationId, integration.ActivationMaxConcurrency);
        var jobId = _jobService.Enqueue<ISasActivationService>(
            service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, connectionString),
            queueName);
        
        log.JobId = jobId;
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"[SAS_Activation_007] Enqueued activation for user {username} (ID: {userId}) via integration {integrationName} with priority {priority} in queue {queueName}");
        
        return jobId;
    }
    
    /// <summary>
    /// Enqueue multiple activations in a batch for better performance
    /// </summary>
    public async Task<List<string>> EnqueueBatchActivationsAsync(
        int integrationId, 
        string integrationName, 
        List<(int userId, string username, object data)> activations)
    {
        if (!activations.Any())
            return new List<string>();
        
        // Get integration settings once
        var integration = await _context.SasRadiusIntegrations
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == integrationId);
        
        if (integration == null)
        {
            throw new ArgumentException($"Integration {integrationId} not found");
        }
        
        if (!integration.SendActivationsToSas)
        {
            _logger.LogInformation($"[SAS_Activation_008] Batch activation skipped - SendActivationsToSas is disabled for integration {integrationName}");
            return new List<string>();
        }
        
        // Get existing pending user IDs to prevent duplicates
        var userIds = activations.Select(a => a.userId).ToList();
        var existingPending = await _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId 
                     && userIds.Contains(l.UserId)
                     && (l.Status == ActivationStatus.Pending || l.Status == ActivationStatus.Processing))
            .Select(l => l.UserId)
            .ToListAsync();
        
        var logs = new List<SasActivationLog>();
        var jobIds = new List<string>();
        
        foreach (var activation in activations)
        {
            // Skip if already pending
            if (existingPending.Contains(activation.userId))
            {
                _logger.LogWarning($"[SAS_Activation_009] Skipping duplicate activation for user {activation.username} (ID: {activation.userId})");
                continue;
            }
            
            var log = new SasActivationLog
            {
                IntegrationId = integrationId,
                IntegrationName = integrationName,
                UserId = activation.userId,
                Username = activation.username,
                ActivationData = System.Text.Json.JsonSerializer.Serialize(activation.data),
                Status = ActivationStatus.Pending,
                RetryCount = 0,
                MaxRetries = integration.ActivationMaxRetries,
                CreatedAt = DateTime.UtcNow
            };
            
            logs.Add(log);
        }
        
        // Bulk insert for better performance
        _context.SasActivationLogs.AddRange(logs);
        await _context.SaveChangesAsync();
        
        // Get workspace info for job execution
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo?.ConnectionString == null)
        {
            throw new InvalidOperationException("No tenant context or connection string available");
        }
        
        // Enqueue jobs
        var batchConnectionString = tenantInfo.ConnectionString;
        foreach (var log in logs)
        {
            var jobId = _jobService.Enqueue<ISasActivationService>(
                service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, batchConnectionString));
            
            log.JobId = jobId;
            jobIds.Add(jobId);
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"[SAS_Activation_010] Enqueued {logs.Count} activations in batch for integration {integrationName}");
        
        return jobIds;
    }
    
    /// <summary>
    /// Process a single activation (called by Hangfire)
    /// </summary>
    [AutomaticRetry(Attempts = 0)] // We handle retries manually
    public async Task ProcessActivationAsync(int logId, int workspaceId, string connectionString)
    {
        _logger.LogInformation($"[SAS_Activation_011] Processing activation {logId} for workspace {workspaceId}");
        
        // Create workspace-specific context (Hangfire jobs don't have HTTP context/tenant info)
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        using var workspaceContext = new ApplicationDbContext(optionsBuilder.Options);
        
        var log = await workspaceContext.SasActivationLogs
            .Include(l => l.Integration)
            .FirstOrDefaultAsync(l => l.Id == logId);
        
        if (log == null)
        {
            _logger.LogError($"[SAS_Activation_012] Activation log {logId} not found in workspace {workspaceId}");
            return;
        }
        
        if (log.Integration == null)
        {
            _logger.LogError($"[SAS_Activation_013] Integration {log.IntegrationId} not found for activation {logId}");
            return;
        }
        
        // Cache integration to avoid multiple property accesses
        var integration = log.Integration;
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            log.Status = ActivationStatus.Processing;
            log.ProcessedAt = DateTime.UtcNow;
            await workspaceContext.SaveChangesAsync();
            
            _logger.LogInformation($"[SAS_Activation_014] Processing activation {logId} for user {log.Username}");
            
            // Send HTTP request to SAS4
            var response = await SendActivationToSas4Async(integration, log, workspaceContext);
            
            stopwatch.Stop();
            
            log.Status = ActivationStatus.Success;
            log.ResponseStatusCode = (int)response.StatusCode;
            log.ResponseBody = response.Body;
            log.DurationMs = stopwatch.ElapsedMilliseconds;
            
            _logger.LogInformation($"[SAS_Activation_015] Activation {logId} completed successfully in {stopwatch.ElapsedMilliseconds}ms");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            log.Status = ActivationStatus.Failed;
            log.ErrorMessage = ex.Message;
            log.DurationMs = stopwatch.ElapsedMilliseconds;
            log.RetryCount++;
            
            _logger.LogError(ex, $"[SAS_Activation_016] Activation {logId} failed (attempt {log.RetryCount}/{log.MaxRetries})");
            
            // Schedule retry if not exceeded max retries
            if (log.RetryCount < log.MaxRetries)
            {
                // Use cached integration for retry settings (already loaded via Include)
                var baseDelayMinutes = integration.ActivationRetryDelayMinutes;
                var useExponentialBackoff = integration.ActivationUseExponentialBackoff;
                
                var delay = useExponentialBackoff 
                    ? TimeSpan.FromMinutes(Math.Pow(2, log.RetryCount) * baseDelayMinutes)
                    : TimeSpan.FromMinutes(log.RetryCount * baseDelayMinutes);
                    
                log.NextRetryAt = DateTime.UtcNow.Add(delay);
                
                // Cannot use _jobService here because we don't have tenant context
                // For now, log the retry need - proper retry mechanism would need workspace context
                _logger.LogWarning($"[SAS_Activation_017] Activation {logId} needs retry but retry scheduling requires workspace context");
                
                _logger.LogInformation($"[SAS_Activation_018] Would schedule retry for activation {logId} in {delay.TotalMinutes} minutes");
            }
            else
            {
                log.Status = ActivationStatus.MaxRetriesReached;
                _logger.LogWarning($"[SAS_Activation_019] Activation {logId} reached max retries ({log.MaxRetries})");
            }
        }
        finally
        {
            await workspaceContext.SaveChangesAsync();
        }
    }
    
    /// <summary>
    /// Send activation HTTP request to SAS4 API
    /// </summary>
    private async Task<SasActivationResponse> SendActivationToSas4Async(SasRadiusIntegration integration, SasActivationLog log, ApplicationDbContext context)
    {
        // TODO: Remove this block when SAS4 integration is ready
        throw new InvalidOperationException("SAS4 activation is temporarily disabled");
#pragma warning disable CS0162 // Unreachable code detected — keeping implementation for when SAS4 integration is enabled
        _logger.LogInformation($"[SAS_Activation_020] Sending activation to SAS4: {integration.Url} for user {log.Username}");
        
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(integration.ActivationTimeoutSeconds);
        
        try
        {
            // Parse activation data to extract details
            var activationData = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(log.ActivationData);
            
            // Use PIN from log if available (PrepaidCard activation method), otherwise from activation data
            string? pin = null;
            
            if (!string.IsNullOrEmpty(log.Pin))
            {
                // PIN was retrieved during enqueue phase (PrepaidCard method)
                pin = log.Pin;
            }
            else if (activationData.TryGetProperty("pin", out var pinProp) && pinProp.ValueKind != System.Text.Json.JsonValueKind.Null)
            {
                // PIN was provided in activation data
                pin = pinProp.GetString();
            }
            
            if (string.IsNullOrEmpty(pin))
            {
                throw new InvalidOperationException(
                    $"PIN is required for SAS activation but was not found. " +
                    $"Integration '{integration.Name}' has ActivationMethod={integration.ActivationMethod}. " +
                    $"If using PrepaidCard method, ensure CardStockUserId is set and cards are available. " +
                    $"If using other methods, ensure PIN is provided in activation data.");
            }
            
            // Get RadiusUser's ExternalId (SAS4 user ID) based on log.UserId
            _logger.LogInformation($"[SAS_Activation_058] Looking up RadiusUser for UserId: {log.UserId}");
            
            var radiusUser = await context.RadiusUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == log.UserId);
            
            if (radiusUser == null)
            {
                throw new InvalidOperationException($"RadiusUser with UserId {log.UserId} not found in database");
            }
            
            if (radiusUser.ExternalId <= 0)
            {
                throw new InvalidOperationException(
                    $"RadiusUser '{radiusUser.Username}' (UserId: {log.UserId}) does not have an ExternalId (SAS4 user ID). " +
                    "Please sync users with SAS4 first.");
            }
            
            var sasUserId = radiusUser.ExternalId.ToString();
            _logger.LogInformation($"[SAS_Activation_021] Using SAS4 user ID: {sasUserId} for RadiusUser {radiusUser.Username}");
            
            var comment = activationData.TryGetProperty("comment", out var commentProp) 
                ? commentProp.GetString() 
                : $"Activation via integration {log.IntegrationName}";
            
            // If using prepaid card, add series info to comment
            if (!string.IsNullOrEmpty(log.CardSeries))
            {
                comment = $"{comment} [Card Series: {log.CardSeries}, Serial: {log.CardSerialNumber}]";
            }
            
            // Build SAS4 API URL
            var baseUrl = integration.Url.Trim().TrimEnd('/');
            var uri = new Uri(baseUrl);
            var activateUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/user/activate_xxx";
            
            _logger.LogInformation($"[SAS_Activation_022] Activating user {log.Username} (SAS4 ID: {sasUserId}) with PIN {pin} on {activateUrl}");
            
            // Prepare JSON payload for SAS4 activation
            var payload = new
            {
                method = "card",
                pin = pin,
                user_id = sasUserId,
                money_collected = 1,
                comments = comment,
                user_price = 0, // Can be set based on activation data if needed
                issue_invoice = 0,
                transaction_id = Guid.NewGuid().ToString(),
                activation_units = 1
            };
            
            var requestJson = System.Text.Json.JsonSerializer.Serialize(payload);
            _logger.LogInformation($"[SAS_Activation_023] SAS4 activation payload: {requestJson}");
            
            // Encrypt payload using AES (SAS API requirement)
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            // Get cached token or authenticate if needed
            var token = await GetOrRefreshTokenAsync(integration);
            
            // Set authorization header on client
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            
            // Send request
            var response = await httpClient.PostAsJsonAsync(activateUrl, requestBody);
            var responseBody = await response.Content.ReadAsStringAsync();
            
            _logger.LogInformation($"[SAS_Activation_024] SAS4 activation response: Status={response.StatusCode}, Body={responseBody}");
            
            // Check for specific SAS4 error responses
            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogError($"[SAS_Activation_025] SAS4 returned 403 Forbidden for user {log.Username} - Check credentials: {integration.Username}@{integration.Url}");
                throw new HttpRequestException($"SAS4 authentication failed (403 Forbidden). Check integration credentials.");
            }
            
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"SAS4 returned status {response.StatusCode}: {responseBody}");
            }
            
            // Parse JSON response to check for SAS4-specific errors
            var jsonResponse = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseBody);
            
            // Check for status field (200 = success, -1 or other = error)
            if (jsonResponse.TryGetProperty("status", out var statusProp))
            {
                var status = statusProp.GetInt32();
                var message = jsonResponse.TryGetProperty("message", out var msgProp) 
                    ? msgProp.GetString() 
                    : "Unknown response";
                
                if (status != 200)
                {
                    _logger.LogError($"[SAS_Activation_026] SAS4 activation failed for user {log.Username}: status={status}, message={message}");
                    throw new HttpRequestException($"SAS4 activation failed: {message} (status: {status})");
                }
                
                _logger.LogInformation($"[SAS_Activation_027] SAS4 activation successful: {message}");
            }
            else
            {
                _logger.LogWarning($"[SAS_Activation_028] SAS4 response missing status field: {responseBody}");
            }
            
            _logger.LogInformation($"[SAS_Activation_029] SAS4 activation successful for user {log.Username}");
            
            return new SasActivationResponse
            {
                StatusCode = response.StatusCode,
                Body = responseBody
            };
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogError(ex, $"[SAS_Activation_030] SAS4 activation timed out after {integration.ActivationTimeoutSeconds} seconds for user {log.Username}");
            throw new TimeoutException($"Activation request timed out after {integration.ActivationTimeoutSeconds} seconds", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, $"[SAS_Activation_031] HTTP error during SAS4 activation for user {log.Username}");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"[SAS_Activation_032] Unexpected error during SAS4 activation for user {log.Username}");
            throw new HttpRequestException($"Activation failed: {ex.Message}", ex);
        }
#pragma warning restore CS0162
    }
    
    /// <summary>
    /// Retry all failed activations for an integration
    /// </summary>
    public async Task<int> RetryFailedActivationsAsync(int integrationId, DateTime? fromDate = null)
    {
        var query = _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId)
            .Where(l => l.Status == ActivationStatus.Failed || l.Status == ActivationStatus.MaxRetriesReached)
            .Where(l => l.RetryCount < l.MaxRetries); // Only retry if max retries not reached
        
        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= fromDate.Value);
        }
        
        var failedLogs = await query.ToListAsync();
        
        // Get workspace info for job execution
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo?.ConnectionString == null)
        {
            throw new InvalidOperationException("No tenant context or connection string available");
        }
        
        var retryConnectionString = tenantInfo.ConnectionString;
        foreach (var log in failedLogs)
        {
            // Reset retry count and status
            log.RetryCount = 0;
            log.Status = ActivationStatus.Pending;
            log.ErrorMessage = null;
            log.NextRetryAt = null;
            
            // Enqueue job
            var jobId = _jobService.Enqueue<ISasActivationService>(
                service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, retryConnectionString));
            
            log.JobId = jobId;
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"[SAS_Activation_033] Retrying {failedLogs.Count} failed activations for integration {integrationId}");
        
        return failedLogs.Count;
    }
    
    /// <summary>
    /// Retry a single activation log
    /// </summary>
    public async Task<bool> RetrySingleActivationAsync(int logId)
    {
        var log = await _context.SasActivationLogs
            .Include(l => l.Integration)
            .FirstOrDefaultAsync(l => l.Id == logId);
        
        if (log == null || log.Integration == null)
        {
            return false;
        }
        
        // Check if max retries reached
        if (log.RetryCount >= log.MaxRetries)
        {
            _logger.LogWarning($"[SAS_Activation_035] Cannot retry activation log {logId} - max retries ({log.MaxRetries}) reached");
            throw new InvalidOperationException($"Maximum retry limit ({log.MaxRetries}) has been reached for this activation");
        }
        
        // Get workspace info for job execution
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo?.ConnectionString == null)
        {
            throw new InvalidOperationException("No tenant context or connection string available");
        }
        
        // Increment retry count and reset status
        log.RetryCount++;
        log.Status = ActivationStatus.Pending;
        log.NextRetryAt = null;
        log.ErrorMessage = null;
        
        // Re-enqueue the activation job
        var singleRetryConnectionString = tenantInfo.ConnectionString;
        var jobId = _jobService.Enqueue<ISasActivationService>(
            service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, singleRetryConnectionString));
        
        log.JobId = jobId;
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"[SAS_Activation_034] Re-enqueued activation log {logId} for user {log.Username}");
        
        return true;
    }
    
    /// <summary>
    /// Get count of retryable failed activations
    /// </summary>
    public async Task<int> GetRetryableCountAsync(int integrationId, DateTime? fromDate = null)
    {
        var query = _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId)
            .Where(l => l.Status == ActivationStatus.Failed || l.Status == ActivationStatus.MaxRetriesReached)
            .Where(l => l.RetryCount < l.MaxRetries);
        
        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= fromDate.Value);
        }
        
        return await query.CountAsync();
    }
    
    /// <summary>
    /// Get activation logs with pagination and optional search
    /// </summary>
    public async Task<List<SasActivationLog>> GetActivationLogsAsync(int integrationId, int page = 1, int pageSize = 50, string? search = null)
    {
        var query = _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId);
        
        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(l => l.Username != null && l.Username.Contains(search));
        }
        
        return await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }
    
    /// <summary>
    /// Get a single activation log
    /// </summary>
    public async Task<SasActivationLog?> GetActivationLogAsync(int logId)
    {
        return await _context.SasActivationLogs
            .Include(l => l.Integration)
            .FirstOrDefaultAsync(l => l.Id == logId);
    }
    
    /// <summary>
    /// Get activation metrics for monitoring and dashboards
    /// </summary>
    public async Task<ActivationMetrics> GetMetricsAsync(int integrationId, DateTime? fromDate = null)
    {
        var query = _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId);
        
        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= fromDate.Value);
        }
        
        var logs = await query.ToListAsync();
        
        var metrics = new ActivationMetrics
        {
            TotalActivations = logs.Count,
            SuccessCount = logs.Count(l => l.Status == ActivationStatus.Success),
            FailedCount = logs.Count(l => l.Status == ActivationStatus.Failed),
            PendingCount = logs.Count(l => l.Status == ActivationStatus.Pending),
            ProcessingCount = logs.Count(l => l.Status == ActivationStatus.Processing),
            MaxRetriesReachedCount = logs.Count(l => l.Status == ActivationStatus.MaxRetriesReached),
            AverageDurationMs = logs.Where(l => l.DurationMs > 0).Average(l => (double?)l.DurationMs) ?? 0,
            SuccessRate = logs.Count > 0 ? (double)logs.Count(l => l.Status == ActivationStatus.Success) / logs.Count * 100 : 0,
            LastActivationDate = logs.Any() ? logs.Max(l => l.CreatedAt) : (DateTime?)null
        };
        
        return metrics;
    }
    
    /// <summary>
    /// Check if integration is healthy based on recent activation success rate (circuit breaker pattern)
    /// </summary>
    public async Task<bool> IsIntegrationHealthyAsync(int integrationId)
    {
        // Check last 100 activations or last hour
        var oneHourAgo = DateTime.UtcNow.AddHours(-1);
        
        var recentLogs = await _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId 
                     && l.CreatedAt >= oneHourAgo
                     && (l.Status == ActivationStatus.Success || l.Status == ActivationStatus.Failed || l.Status == ActivationStatus.MaxRetriesReached))
            .OrderByDescending(l => l.CreatedAt)
            .Take(100)
            .ToListAsync();
        
        if (!recentLogs.Any())
        {
            return true; // No data, assume healthy
        }
        
        var successCount = recentLogs.Count(l => l.Status == ActivationStatus.Success);
        var successRate = (double)successCount / recentLogs.Count * 100;
        
        // Circuit breaker threshold: Consider unhealthy if success rate < 50%
        var isHealthy = successRate >= 50;
        
        if (!isHealthy)
        {
            _logger.LogWarning($"[SAS_Activation_034] Integration {integrationId} is unhealthy. Success rate: {successRate:F2}% ({successCount}/{recentLogs.Count})");
        }
        
        return isHealthy;
    }
    
    /// <summary>
    /// Get cached token or authenticate if token is expired/missing
    /// </summary>
    private async Task<string> GetOrRefreshTokenAsync(SasRadiusIntegration integration)
    {
        await _tokenCacheLock.WaitAsync();
        try
        {
            // Get workspace ID from tenant context
            var workspaceId = _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? 0;
            var cacheKey = $"{workspaceId}:{integration.Id}";
            
            // Check if we have a valid cached token
            if (_tokenCache.TryGetValue(cacheKey, out var cached) && cached.expiresAt > DateTime.UtcNow)
            {
                _logger.LogInformation($"[SAS_Activation_037] ♻️ Using cached token for workspace {workspaceId}, integration {integration.Id}");
                return cached.token;
            }
            
            // Token expired or not found, authenticate
            var token = await AuthenticateAsync(integration);
            
            // Cache token for 10 minutes
            _tokenCache[cacheKey] = (token, DateTime.UtcNow.AddMinutes(10));
            
            return token;
        }
        finally
        {
            _tokenCacheLock.Release();
        }
    }
    
    /// <summary>
    /// Authenticate with SAS4 API and get Bearer token
    /// </summary>
    private async Task<string> AuthenticateAsync(SasRadiusIntegration integration)
    {
        var client = _httpClientFactory.CreateClient();
        var baseUrl = integration.Url.Trim().TrimEnd('/');
        
        // Construct the login URL with SAS API path
        var uri = new Uri(baseUrl);
        var loginUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/login";
        
        _logger.LogInformation($"[SAS_Activation_035] 🔐 Authenticating to: {loginUrl}");
        
        var loginData = new { username = integration.Username, password = integration.Password };
        var loginJson = System.Text.Json.JsonSerializer.Serialize(loginData);
        var encryptedPayload = EncryptionHelper.EncryptAES(loginJson, AES_KEY);
        var requestBody = new { payload = encryptedPayload };
        
        var response = await client.PostAsJsonAsync(loginUrl, requestBody);
        response.EnsureSuccessStatusCode();
        
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = result.GetProperty("token").GetString()
            ?? throw new InvalidOperationException("Authentication response did not contain a valid token");
        
        // Log full response to check for expiration info
        _logger.LogInformation($"[SAS_Activation_036] ✅ Authentication successful, got token. Full response: {result}");
        
        return token;
    }

    /// <summary>    /// Get available card series for a profile from SAS4
    /// </summary>
    private async Task<List<SasCardSeriesData>> GetAvailableCardSeriesAsync(
        SasRadiusIntegration integration, 
        int profileExternalId, 
        int? ownerId = null, 
        bool freeCardsOnly = false)
    {
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(integration.ActivationTimeoutSeconds);
        
        try
        {
            // Build SAS4 API URL for card series
            var baseUrl = integration.Url.Trim().TrimEnd('/');
            var uri = new Uri(baseUrl);
            var seriesUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/series";
            
            _logger.LogInformation($"[SAS_Activation_038] Fetching card series for profile {profileExternalId} from {seriesUrl}");
            
            // Prepare payload
            var payload = new
            {
                page = 1,
                count = 500,
                sortBy = "series_date",
                direction = "desc",
                search = "",
                columns = new[] { "series_date", "series", "type", "value", "qty", "used", "username", "name", "name", "expiration" },
                parent_id = ownerId ?? -1, // -1 means all owners
                type = 0, // -1 means all types -> 0 mean prepaid cards
                profile_id = profileExternalId
            };
            
            // Encrypt payload using AES (SAS API requirement)
            var requestJson = System.Text.Json.JsonSerializer.Serialize(payload);
            _logger.LogInformation($"[SAS_Activation_039] 📦 Card series request payload: {requestJson}");
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            // Get cached token or authenticate if needed
            var token = await GetOrRefreshTokenAsync(integration);
            
            // Set authorization header on client
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            
            var response = await httpClient.PostAsJsonAsync(seriesUrl, requestBody);
            var responseBody = await response.Content.ReadAsStringAsync();
            
            _logger.LogInformation($"[SAS_Activation_040] 📥 Card series response: Status={response.StatusCode}, Body={responseBody}");
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError($"[SAS_Activation_041] Failed to fetch card series: {response.StatusCode} - {responseBody}");
                return new List<SasCardSeriesData>();
            }
            
            var apiResponse = System.Text.Json.JsonSerializer.Deserialize<SasCardSeriesApiResponse>(responseBody);
            if (apiResponse == null || apiResponse.Data == null)
            {
                _logger.LogWarning($"[SAS_Activation_042] No card series data returned for profile {profileExternalId}");
                return new List<SasCardSeriesData>();
            }
            
            // Filter for available cards (qty > used)
            var availableSeries = apiResponse.Data
                .Where(s => {
                    var usedCount = string.IsNullOrWhiteSpace(s.Used) ? 0 : int.Parse(s.Used);
                    return s.Qty > usedCount;
                })
                .ToList();
            
            _logger.LogInformation($"[SAS_Activation_043] Found {availableSeries.Count} series with available cards for profile {profileExternalId}");
            
            return availableSeries;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"[SAS_Activation_044] Error fetching card series for profile {profileExternalId}");
            return new List<SasCardSeriesData>();
        }
    }
    
    /// <summary>
    /// Get unused PIN from a card series
    /// </summary>
    private async Task<SasCardPinData?> GetUnusedPinFromSeriesAsync(SasRadiusIntegration integration, string series)
    {
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(integration.ActivationTimeoutSeconds);
        
        try
        {
            // Build SAS4 API URL for card PINs
            var baseUrl = integration.Url.Trim().TrimEnd('/');
            var uri = new Uri(baseUrl);
            var cardUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/card/{series}";
            
            _logger.LogInformation($"[SAS_Activation_045] Fetching unused PINs from series {series} at {cardUrl}");
            
            // Prepare payload
            var payload = new
            {
                page = 1,
                count = 10,
                sortBy = "id",
                direction = "asc",
                search = "",
                columns = new[] { "id", "serialnumber", "pin", "username", "password", "used_at", "username", "username" }
            };
            
            // Encrypt payload using AES (SAS API requirement)
            var requestJson = System.Text.Json.JsonSerializer.Serialize(payload);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            // Get cached token or authenticate if needed
            var token = await GetOrRefreshTokenAsync(integration);
            
            // Set authorization header on client
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            
            var response = await httpClient.PostAsJsonAsync(cardUrl, requestBody);
            var responseBody = await response.Content.ReadAsStringAsync();
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError($"[SAS_Activation_046] Failed to fetch PINs from series {series}: {response.StatusCode} - {responseBody}");
                return null;
            }
            
            var apiResponse = System.Text.Json.JsonSerializer.Deserialize<SasCardPinApiResponse>(responseBody);
            if (apiResponse == null || apiResponse.Data == null || apiResponse.Data.Count == 0)
            {
                _logger.LogWarning($"[SAS_Activation_047] No PIN data returned for series {series}");
                return null;
            }
            
            // Find first unused PIN (where username is null)
            var unusedPin = apiResponse.Data.FirstOrDefault(p => string.IsNullOrWhiteSpace(p.Username));
            
            if (unusedPin != null)
            {
                _logger.LogInformation($"[SAS_Activation_048] Found unused PIN {unusedPin.Pin} from series {series}");
            }
            else
            {
                _logger.LogWarning($"[SAS_Activation_049] No unused PINs found in series {series}");
            }
            
            return unusedPin;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"[SAS_Activation_050] Error fetching PINs from series {series}");
            return null;
        }
    }
    
    /// <summary>
    /// Get PIN for prepaid card activation based on integration settings
    /// </summary>
    private async Task<(string? pin, string? series, string? serialNumber)> GetPrepaidCardPinAsync(
        SasRadiusIntegration integration, 
        int profileExternalId,
        ApplicationDbContext context)
    {
        try
        {
            _logger.LogInformation($"[SAS_Activation_051] Getting prepaid card PIN for profile {profileExternalId}");
            
            // Determine owner ID based on integration settings
            int? ownerId = null;
            if (!integration.AllowAnyCardStockUser && integration.CardStockUserId.HasValue)
            {
                // CardStockUserId is the SAS4 manager ID
                ownerId = integration.CardStockUserId.Value;
                _logger.LogInformation($"[SAS_Activation_052] Using specific card stock user: {ownerId}");
            }
            
            // Get available card series
            var availableSeries = await GetAvailableCardSeriesAsync(
                integration, 
                profileExternalId, 
                ownerId, 
                integration.UseFreeCardsOnly);
            
            if (availableSeries.Count == 0)
            {
                _logger.LogWarning($"[SAS_Activation_053] No available card series found for profile {profileExternalId}");
                return (null, null, null);
            }
            
            // Try to get a PIN from each series until we find an unused one
            foreach (var series in availableSeries)
            {
                if (string.IsNullOrWhiteSpace(series.Series))
                    continue;
                    
                var pinData = await GetUnusedPinFromSeriesAsync(integration, series.Series);
                if (pinData != null && !string.IsNullOrWhiteSpace(pinData.Pin))
                {
                    _logger.LogInformation($"[SAS_Activation_054] Found PIN {pinData.Pin} from series {series.Series} for profile {profileExternalId}");
                    return (pinData.Pin, series.Series, pinData.SerialNumber);
                }
            }
            
            _logger.LogWarning($"[SAS_Activation_055] No unused PINs found in any available series for profile {profileExternalId}");
            return (null, null, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"[SAS_Activation_056] Error getting prepaid card PIN for profile {profileExternalId}");
            return (null, null, null);
        }
    }

    /// <summary>
    /// Check if prepaid cards are available for activation
    /// </summary>
    public async Task<(bool available, string? errorMessage)> CheckCardAvailabilityAsync(
        int integrationId,
        int radiusProfileId)
    {
        try
        {
            var integration = await _context.SasRadiusIntegrations
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == integrationId);

            if (integration == null)
            {
                return (false, "Integration not found");
            }

            // Only check if CheckCardAvailabilityBeforeActivate is enabled and using PrepaidCard method
            if (!integration.CheckCardAvailabilityBeforeActivate || integration.ActivationMethod != "PrepaidCard")
            {
                return (true, null); // Check not required
            }

            // Get the radius profile to fetch its ExternalId (SAS4 profile ID)
            var radiusProfile = await _context.RadiusProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == radiusProfileId);

            if (radiusProfile == null)
            {
                return (false, "RADIUS profile not found");
            }

            if (radiusProfile.ExternalId == 0)
            {
                return (false, $"RADIUS profile '{radiusProfile.Name}' does not have an ExternalId (SAS4 profile ID). Please sync profiles first.");
            }

            _logger.LogInformation($"[SAS_CardCheck_001] Checking card availability for profile '{radiusProfile.Name}' (External ID: {radiusProfile.ExternalId})");

            // Determine owner ID based on integration settings
            int? ownerId = null;
            if (!integration.AllowAnyCardStockUser && integration.CardStockUserId.HasValue)
            {
                ownerId = integration.CardStockUserId.Value;
            }

            // Get available card series
            var availableSeries = await GetAvailableCardSeriesAsync(
                integration,
                radiusProfile.ExternalId,
                ownerId,
                integration.UseFreeCardsOnly);

            if (availableSeries.Count == 0)
            {
                _logger.LogWarning($"[SAS_CardCheck_002] No card series available for profile '{radiusProfile.Name}' (External ID: {radiusProfile.ExternalId})");
                return (false, $"No prepaid card series available for profile '{radiusProfile.Name}'. Please add cards to inventory.");
            }

            // Check if any series has available PINs
            foreach (var series in availableSeries)
            {
                if (string.IsNullOrWhiteSpace(series.Series))
                    continue;

                var pinData = await GetUnusedPinFromSeriesAsync(integration, series.Series);
                if (pinData != null && !string.IsNullOrWhiteSpace(pinData.Pin))
                {
                    _logger.LogInformation($"[SAS_CardCheck_003] Card available in series '{series.Series}' for profile '{radiusProfile.Name}'");
                    return (true, null); // Card found
                }
            }

            _logger.LogWarning($"[SAS_CardCheck_004] No unused cards found in any series for profile '{radiusProfile.Name}' (External ID: {radiusProfile.ExternalId})");
            return (false, $"No unused prepaid cards available for profile '{radiusProfile.Name}'. All cards in inventory have been used.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"[SAS_CardCheck_005] Error checking card availability for profile {radiusProfileId}");
            return (false, $"Error checking card availability: {ex.Message}");
        }
    }
}

/// <summary>
/// Activation metrics for monitoring
/// </summary>
public class ActivationMetrics
{
    public int TotalActivations { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public int PendingCount { get; set; }
    public int ProcessingCount { get; set; }
    public int MaxRetriesReachedCount { get; set; }
    public double AverageDurationMs { get; set; }
    public double SuccessRate { get; set; }
    public DateTime? LastActivationDate { get; set; }
}

public class SasActivationResponse
{
    public System.Net.HttpStatusCode StatusCode { get; set; }
    public string Body { get; set; } = string.Empty;
}
