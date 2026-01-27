using Backend.Data;
using Backend.Models;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;

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
    /// Send activation HTTP request to SAS4 (dummy implementation for testing)
    /// </summary>
    private async Task<SasActivationResponse> SendActivationToSas4Async(SasRadiusIntegration integration, SasActivationLog log)
    {
        // Dummy implementation for testing
        // TODO: Replace with actual SAS4 API call
        
        _logger.LogInformation($"[DUMMY] Sending activation to SAS4: {integration.Url}");
        _logger.LogInformation($"[DUMMY] User: {log.Username}, Timeout: {integration.ActivationTimeoutSeconds}s");
        
        // Simulate API call with timeout
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(integration.ActivationTimeoutSeconds));
        
        try
        {
            await Task.Delay(Random.Shared.Next(100, 500), cts.Token);
            
            // Simulate random failures for testing retry mechanism (20% failure rate)
            if (Random.Shared.Next(100) < 20)
            {
                throw new HttpRequestException("Simulated HTTP error: Connection timeout");
            }
        }
        catch (OperationCanceledException)
        {
            throw new TimeoutException($"Activation request timed out after {integration.ActivationTimeoutSeconds} seconds");
        }
        
        // Simulate success response
        return new SasActivationResponse
        {
            StatusCode = System.Net.HttpStatusCode.OK,
            Body = $"{{\"success\": true, \"message\": \"Activation sent successfully\", \"timestamp\": \"{DateTime.UtcNow:O}\"}}"
        };
        
        /* REAL IMPLEMENTATION (uncomment when ready):
        var httpClient = _httpClientFactory.CreateClient();
        var protocol = integration.UseHttps ? "https" : "http";
        var url = $"{protocol}://{integration.Url}/api/activation";
        
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Basic {Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{integration.Username}:{integration.Password}"))}");
        request.Content = new StringContent(log.ActivationData, System.Text.Encoding.UTF8, "application/json");
        
        var response = await httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        
        response.EnsureSuccessStatusCode();
        
        return new SasActivationResponse
        {
            StatusCode = response.StatusCode,
            Body = responseBody
        };
        */
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
