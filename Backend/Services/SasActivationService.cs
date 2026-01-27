using Backend.Data;
using Backend.Models;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace Backend.Services;

public interface ISasActivationService
{
    Task<string> EnqueueActivationAsync(int integrationId, string integrationName, int userId, string username, object activationData);
    Task ProcessActivationAsync(int logId);
    Task<int> RetryFailedActivationsAsync(int integrationId, DateTime? fromDate = null);
    Task<List<SasActivationLog>> GetActivationLogsAsync(int integrationId, int page = 1, int pageSize = 50);
    Task<SasActivationLog?> GetActivationLogAsync(int logId);
}

public class SasActivationService : ISasActivationService
{
    private readonly ApplicationDbContext _context;
    private readonly IWorkspaceJobService _jobService;
    private readonly ILogger<SasActivationService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    
    public SasActivationService(
        ApplicationDbContext context,
        IWorkspaceJobService jobService,
        ILogger<SasActivationService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _jobService = jobService;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }
    
    /// <summary>
    /// Enqueue a new activation to be sent to SAS4
    /// </summary>
    public async Task<string> EnqueueActivationAsync(int integrationId, string integrationName, int userId, string username, object activationData)
    {
        // Get integration settings for queue configuration
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == integrationId);
        
        var log = new SasActivationLog
        {
            IntegrationId = integrationId,
            IntegrationName = integrationName,
            UserId = userId,
            Username = username,
            ActivationData = System.Text.Json.JsonSerializer.Serialize(activationData),
            Status = ActivationStatus.Pending,
            RetryCount = 0,
            MaxRetries = integration?.ActivationMaxRetries ?? 3,
            CreatedAt = DateTime.UtcNow
        };
        
        _context.SasActivationLogs.Add(log);
        await _context.SaveChangesAsync();
        
        // Enqueue Hangfire job
        var jobId = _jobService.Enqueue<ISasActivationService>(
            service => service.ProcessActivationAsync(log.Id));
        
        log.JobId = jobId;
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"Enqueued activation for user {username} (ID: {userId}) via integration {integrationName}");
        
        return jobId;
    }
    
    /// <summary>
    /// Process a single activation (called by Hangfire)
    /// </summary>
    [AutomaticRetry(Attempts = 0)] // We handle retries manually
    public async Task ProcessActivationAsync(int logId)
    {
        var log = await _context.SasActivationLogs
            .Include(l => l.Integration)
            .FirstOrDefaultAsync(l => l.Id == logId);
        
        if (log == null)
        {
            _logger.LogError($"Activation log {logId} not found");
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
            await _context.SaveChangesAsync();
            
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
                
                var retryJobId = _jobService.Schedule<ISasActivationService>(
                    service => service.ProcessActivationAsync(logId),
                    delay);
                
                log.JobId = retryJobId;
                
                _logger.LogInformation($"Scheduled retry for activation {logId} in {delay.TotalMinutes} minutes");
            }
            else
            {
                log.Status = ActivationStatus.MaxRetriesReached;
                _logger.LogWarning($"Activation {logId} reached max retries ({log.MaxRetries})");
            }
        }
        finally
        {
            await _context.SaveChangesAsync();
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
        _logger.LogInformation($"[DUMMY] User: {log.Username}, Data: {log.ActivationData}");
        
        // Simulate API call delay
        await Task.Delay(Random.Shared.Next(100, 500));
        
        // Simulate random failures for testing retry mechanism (20% failure rate)
        if (Random.Shared.Next(100) < 20)
        {
            throw new HttpRequestException("Simulated HTTP error: Connection timeout");
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
        
        foreach (var log in failedLogs)
        {
            // Reset retry count and status
            log.RetryCount = 0;
            log.Status = ActivationStatus.Pending;
            log.ErrorMessage = null;
            log.NextRetryAt = null;
            
            // Enqueue job
            var jobId = _jobService.Enqueue<ISasActivationService>(
                service => service.ProcessActivationAsync(log.Id));
            
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
}

public class SasActivationResponse
{
    public System.Net.HttpStatusCode StatusCode { get; set; }
    public string Body { get; set; } = string.Empty;
}
