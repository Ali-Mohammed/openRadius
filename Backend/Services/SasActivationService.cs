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
    Task<List<SasActivationLog>> GetActivationLogsAsync(int integrationId, int page = 1, int pageSize = 50);
    Task<SasActivationLog?> GetActivationLogAsync(int logId);
    Task<ActivationMetrics> GetMetricsAsync(int integrationId, DateTime? fromDate = null);
    Task<bool> IsIntegrationHealthyAsync(int integrationId);
}

public class SasActivationService : ISasActivationService
{
    private const string AES_KEY = "abcdefghijuklmno0123456789012345";
    
    private readonly ApplicationDbContext _context;
    private readonly IWorkspaceJobService _jobService;
    private readonly ILogger<SasActivationService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;
    
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
            _logger.LogWarning($"Duplicate activation prevented for user {username} (ID: {userId}) via integration {integrationName}");
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
            _logger.LogInformation($"Activation skipped - SendActivationsToSas is disabled for integration {integrationName}");
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
        
         _logger.LogInformation("integration.ActivationMethod: {ActivationMethod}", integration.ActivationMethod);

        // If activation method is PrepaidCard, fetch PIN from card inventory
        if (integration.ActivationMethod == "PrepaidCard")
        {

            _logger.LogInformation("Fetching prepaid card PIN for activation");

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
                        throw new InvalidOperationException(
                            $"No available prepaid cards found for profile '{radiusProfile.Name}' (ID: {radiusProfile.ExternalId}). " +
                            "Please check card stock or contact administrator.");
                    }
                    
                    // Store PIN information in the log
                    log.Pin = pin;
                    log.CardSeries = series;
                    log.CardSerialNumber = serialNumber;
                    
                    _logger.LogInformation(
                        $"Retrieved PIN {pin} from series {series} (serial: {serialNumber}) for user {username} activation");
                }
                else
                {
                    throw new InvalidOperationException("Activation data does not contain radiusProfileId");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to retrieve prepaid card PIN for user {username}");
                throw; // Fail the activation if we can't get a PIN
            }
        }
        
        _context.SasActivationLogs.Add(log);
        await _context.SaveChangesAsync();
        
        // Get workspace info for job execution
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        // Enqueue Hangfire job with integration-specific queue for concurrency control
        var queueName = _jobService.GetIntegrationQueue(integrationId, integration.ActivationMaxConcurrency);
        var jobId = _jobService.Enqueue<ISasActivationService>(
            service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, tenantInfo.ConnectionString),
            queueName);
        
        log.JobId = jobId;
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"Enqueued activation for user {username} (ID: {userId}) via integration {integrationName} with priority {priority} in queue {queueName}");
        
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
            _logger.LogInformation($"Batch activation skipped - SendActivationsToSas is disabled for integration {integrationName}");
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
                _logger.LogWarning($"Skipping duplicate activation for user {activation.username} (ID: {activation.userId})");
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
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        // Enqueue jobs
        foreach (var log in logs)
        {
            var jobId = _jobService.Enqueue<ISasActivationService>(
                service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, tenantInfo.ConnectionString));
            
            log.JobId = jobId;
            jobIds.Add(jobId);
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"Enqueued {logs.Count} activations in batch for integration {integrationName}");
        
        return jobIds;
    }
    
    /// <summary>
    /// Process a single activation (called by Hangfire)
    /// </summary>
    [AutomaticRetry(Attempts = 0)] // We handle retries manually
    public async Task ProcessActivationAsync(int logId, int workspaceId, string connectionString)
    {
        _logger.LogInformation($"Processing activation {logId} for workspace {workspaceId}");
        
        // Create workspace-specific context (Hangfire jobs don't have HTTP context/tenant info)
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        using var workspaceContext = new ApplicationDbContext(optionsBuilder.Options);
        
        var log = await workspaceContext.SasActivationLogs
            .Include(l => l.Integration)
            .FirstOrDefaultAsync(l => l.Id == logId);
        
        if (log == null)
        {
            _logger.LogError($"Activation log {logId} not found in workspace {workspaceId}");
            return;
        }
        
        if (log.Integration == null)
        {
            _logger.LogError($"Integration {log.IntegrationId} not found for activation {logId}");
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
            
            _logger.LogInformation($"Processing activation {logId} for user {log.Username}");
            
            // Send HTTP request to SAS4
            var response = await SendActivationToSas4Async(integration, log);
            
            stopwatch.Stop();
            
            log.Status = ActivationStatus.Success;
            log.ResponseStatusCode = (int)response.StatusCode;
            log.ResponseBody = response.Body;
            log.DurationMs = stopwatch.ElapsedMilliseconds;
            
            _logger.LogInformation($"Activation {logId} completed successfully in {stopwatch.ElapsedMilliseconds}ms");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            log.Status = ActivationStatus.Failed;
            log.ErrorMessage = ex.Message;
            log.DurationMs = stopwatch.ElapsedMilliseconds;
            log.RetryCount++;
            
            _logger.LogError(ex, $"Activation {logId} failed (attempt {log.RetryCount}/{log.MaxRetries})");
            
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
                _logger.LogWarning($"Activation {logId} needs retry but retry scheduling requires workspace context");
                
                _logger.LogInformation($"Would schedule retry for activation {logId} in {delay.TotalMinutes} minutes");
            }
            else
            {
                log.Status = ActivationStatus.MaxRetriesReached;
                _logger.LogWarning($"Activation {logId} reached max retries ({log.MaxRetries})");
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
    private async Task<SasActivationResponse> SendActivationToSas4Async(SasRadiusIntegration integration, SasActivationLog log)
    {
        _logger.LogInformation($"Sending activation to SAS4: {integration.Url} for user {log.Username}");
        
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
            
            // Get RadiusUser's ExternalId (SAS4 user ID) for the activation
            string? sasUserId = null;
            if (activationData.TryGetProperty("radiusUserId", out var radiusUserIdProp))
            {
                var radiusUserId = radiusUserIdProp.GetInt32();
                var radiusUser = await _context.RadiusUsers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == radiusUserId);
                
                if (radiusUser != null && radiusUser.ExternalId > 0)
                {
                    sasUserId = radiusUser.ExternalId.ToString();
                }
            }
            
            // Fallback to log.UserId if no RadiusUser found
            if (string.IsNullOrEmpty(sasUserId))
            {
                sasUserId = log.UserId.ToString();
                _logger.LogWarning($"Could not find RadiusUser ExternalId, using fallback UserId: {sasUserId}");
            }
            
            var comment = activationData.TryGetProperty("comment", out var commentProp) 
                ? commentProp.GetString() 
                : $"Activation via integration {log.IntegrationName}";
            
            // If using prepaid card, add series info to comment
            if (!string.IsNullOrEmpty(log.CardSeries))
            {
                comment = $"{comment} [Card Series: {log.CardSeries}, Serial: {log.CardSerialNumber}]";
            }
            
            // Build SAS4 API URL
            var protocol = integration.UseHttps ? "https" : "http";
            var baseUrl = integration.Url.TrimEnd('/');
            // Remove protocol from baseUrl if it exists
            baseUrl = System.Text.RegularExpressions.Regex.Replace(baseUrl, @"^https?://", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            var activateUrl = $"{protocol}://{baseUrl}/admin/api/index.php/api/user/activate";
            
            _logger.LogInformation($"Activating user {log.Username} (SAS4 ID: {sasUserId}) with PIN {pin} on {activateUrl}");
            
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
            
            var jsonPayload = System.Text.Json.JsonSerializer.Serialize(payload);
            _logger.LogInformation($"SAS4 activation payload: {jsonPayload}");
            
            // Encrypt payload using AES (SAS API requirement)
            var encryptedPayload = EncryptionHelper.EncryptAES(jsonPayload, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            // Authenticate and get Bearer token
            var token = await AuthenticateAsync(integration);
            
            var request = new HttpRequestMessage(HttpMethod.Post, activateUrl);
            request.Headers.Add("Authorization", $"Bearer {token}");
            request.Headers.Add("Accept", "application/json");
            request.Headers.Add("User-Agent", "OpenRadius/1.0");
            request.Content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(requestBody),
                System.Text.Encoding.UTF8,
                "application/json");
            
            // Send request
            var response = await httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();
            
            _logger.LogInformation($"SAS4 activation response: Status={response.StatusCode}, Body={responseBody}");
            
            // Check for specific SAS4 error responses
            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogError($"SAS4 returned 403 Forbidden for user {log.Username} - Check credentials: {integration.Username}@{integration.Url}");
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
                    _logger.LogError($"SAS4 activation failed for user {log.Username}: status={status}, message={message}");
                    throw new HttpRequestException($"SAS4 activation failed: {message} (status: {status})");
                }
                
                _logger.LogInformation($"SAS4 activation successful: {message}");
            }
            else
            {
                _logger.LogWarning($"SAS4 response missing status field: {responseBody}");
            }
            
            _logger.LogInformation($"SAS4 activation successful for user {log.Username}");
            
            return new SasActivationResponse
            {
                StatusCode = response.StatusCode,
                Body = responseBody
            };
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogError(ex, $"SAS4 activation timed out after {integration.ActivationTimeoutSeconds} seconds for user {log.Username}");
            throw new TimeoutException($"Activation request timed out after {integration.ActivationTimeoutSeconds} seconds", ex);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, $"HTTP error during SAS4 activation for user {log.Username}");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Unexpected error during SAS4 activation for user {log.Username}");
            throw new HttpRequestException($"Activation failed: {ex.Message}", ex);
        }
    }
    
    /// <summary>
    /// Retry all failed activations for an integration
    /// </summary>
    public async Task<int> RetryFailedActivationsAsync(int integrationId, DateTime? fromDate = null)
    {
        var query = _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId)
            .Where(l => l.Status == ActivationStatus.Failed || l.Status == ActivationStatus.MaxRetriesReached);
        
        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= fromDate.Value);
        }
        
        var failedLogs = await query.ToListAsync();
        
        // Get workspace info for job execution
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        foreach (var log in failedLogs)
        {
            // Reset retry count and status
            log.RetryCount = 0;
            log.Status = ActivationStatus.Pending;
            log.ErrorMessage = null;
            log.NextRetryAt = null;
            
            // Enqueue job
            var jobId = _jobService.Enqueue<ISasActivationService>(
                service => service.ProcessActivationAsync(log.Id, tenantInfo.WorkspaceId, tenantInfo.ConnectionString));
            
            log.JobId = jobId;
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"Retrying {failedLogs.Count} failed activations for integration {integrationId}");
        
        return failedLogs.Count;
    }
    
    /// <summary>
    /// Get activation logs with pagination
    /// </summary>
    public async Task<List<SasActivationLog>> GetActivationLogsAsync(int integrationId, int page = 1, int pageSize = 50)
    {
        return await _context.SasActivationLogs
            .Where(l => l.IntegrationId == integrationId)
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
            _logger.LogWarning($"Integration {integrationId} is unhealthy. Success rate: {successRate:F2}% ({successCount}/{recentLogs.Count})");
        }
        
        return isHealthy;
    }
    
    /// <summary>    /// Authenticate with SAS4 API and get Bearer token
    /// </summary>
    private async Task<string> AuthenticateAsync(SasRadiusIntegration integration)
    {
        var client = _httpClientFactory.CreateClient();
        var baseUrl = integration.Url.Trim().TrimEnd('/');
        
        // Construct the login URL with SAS API path
        var uri = new Uri(baseUrl);
        var loginUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/login";
        
        _logger.LogInformation($"🔐 Authenticating to: {loginUrl}");
        
        var loginData = new { username = integration.Username, password = integration.Password };
        var loginJson = System.Text.Json.JsonSerializer.Serialize(loginData);
        var encryptedPayload = EncryptionHelper.EncryptAES(loginJson, AES_KEY);
        var requestBody = new { payload = encryptedPayload };
        
        var response = await client.PostAsJsonAsync(loginUrl, requestBody);
        response.EnsureSuccessStatusCode();
        
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = result.GetProperty("token").GetString();
        
        _logger.LogInformation($"✅ Authentication successful, got token");
        
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
            
            _logger.LogInformation($"Fetching card series for profile {profileExternalId} from {seriesUrl}");
            
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
                type = -1, // -1 means all types
                profile_id = profileExternalId
            };
            
            // Encrypt payload using AES (SAS API requirement)
            var payloadJson = System.Text.Json.JsonSerializer.Serialize(payload);
            var encryptedPayload = EncryptionHelper.EncryptAES(payloadJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            // Authenticate and get Bearer token
            var token = await AuthenticateAsync(integration);
            
            var request = new HttpRequestMessage(HttpMethod.Post, seriesUrl);
            request.Headers.Add("Authorization", $"Bearer {token}");
            request.Headers.Add("Accept", "application/json");
            request.Headers.Add("User-Agent", "OpenRadius/1.0");
            request.Content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(requestBody),
                System.Text.Encoding.UTF8,
                "application/json");
            
            var response = await httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError($"Failed to fetch card series: {response.StatusCode} - {responseBody}");
                return new List<SasCardSeriesData>();
            }
            
            var apiResponse = System.Text.Json.JsonSerializer.Deserialize<SasCardSeriesApiResponse>(responseBody);
            if (apiResponse == null || apiResponse.Data == null)
            {
                _logger.LogWarning($"No card series data returned for profile {profileExternalId}");
                return new List<SasCardSeriesData>();
            }
            
            // Filter for available cards (qty > used)
            var availableSeries = apiResponse.Data
                .Where(s => {
                    var usedCount = string.IsNullOrWhiteSpace(s.Used) ? 0 : int.Parse(s.Used);
                    return s.Qty > usedCount;
                })
                .ToList();
            
            _logger.LogInformation($"Found {availableSeries.Count} series with available cards for profile {profileExternalId}");
            
            return availableSeries;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching card series for profile {profileExternalId}");
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
            var protocol = integration.UseHttps ? "https" : "http";
            var baseUrl = integration.Url.TrimEnd('/');            // Remove protocol from baseUrl if it exists
            baseUrl = System.Text.RegularExpressions.Regex.Replace(baseUrl, @"^https?://", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);            var cardUrl = $"{protocol}://{baseUrl}/admin/api/index.php/api/index/card/{series}";
            
            _logger.LogInformation($"Fetching unused PINs from series {series} at {cardUrl}");
            
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
            var payloadJson = System.Text.Json.JsonSerializer.Serialize(payload);
            var encryptedPayload = EncryptionHelper.EncryptAES(payloadJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            // Authenticate and get Bearer token
            var token = await AuthenticateAsync(integration);
            
            var request = new HttpRequestMessage(HttpMethod.Post, cardUrl);
            request.Headers.Add("Authorization", $"Bearer {token}");
            request.Headers.Add("Accept", "application/json");
            request.Headers.Add("User-Agent", "OpenRadius/1.0");
            request.Content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(requestBody),
                System.Text.Encoding.UTF8,
                "application/json");
            
            var response = await httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError($"Failed to fetch PINs from series {series}: {response.StatusCode} - {responseBody}");
                return null;
            }
            
            var apiResponse = System.Text.Json.JsonSerializer.Deserialize<SasCardPinApiResponse>(responseBody);
            if (apiResponse == null || apiResponse.Data == null || apiResponse.Data.Count == 0)
            {
                _logger.LogWarning($"No PIN data returned for series {series}");
                return null;
            }
            
            // Find first unused PIN (where username is null)
            var unusedPin = apiResponse.Data.FirstOrDefault(p => string.IsNullOrWhiteSpace(p.Username));
            
            if (unusedPin != null)
            {
                _logger.LogInformation($"Found unused PIN {unusedPin.Pin} from series {series}");
            }
            else
            {
                _logger.LogWarning($"No unused PINs found in series {series}");
            }
            
            return unusedPin;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching PINs from series {series}");
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
            _logger.LogInformation($"Getting prepaid card PIN for profile {profileExternalId}");
            
            // Determine owner ID based on integration settings
            int? ownerId = null;
            if (!integration.AllowAnyCardStockUser && integration.CardStockUserId.HasValue)
            {
                // CardStockUserId is the SAS4 manager ID
                ownerId = integration.CardStockUserId.Value;
                _logger.LogInformation($"Using specific card stock user: {ownerId}");
            }
            
            // Get available card series
            var availableSeries = await GetAvailableCardSeriesAsync(
                integration, 
                profileExternalId, 
                ownerId, 
                integration.UseFreeCardsOnly);
            
            if (availableSeries.Count == 0)
            {
                _logger.LogWarning($"No available card series found for profile {profileExternalId}");
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
                    _logger.LogInformation($"Found PIN {pinData.Pin} from series {series.Series} for profile {profileExternalId}");
                    return (pinData.Pin, series.Series, pinData.SerialNumber);
                }
            }
            
            _logger.LogWarning($"No unused PINs found in any available series for profile {profileExternalId}");
            return (null, null, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting prepaid card PIN for profile {profileExternalId}");
            return (null, null, null);
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
