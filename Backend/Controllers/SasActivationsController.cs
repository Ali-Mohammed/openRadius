using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Services;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SasActivationsController : ControllerBase
{
    private readonly ISasActivationService _activationService;
    private readonly ILogger<SasActivationsController> _logger;
    
    public SasActivationsController(
        ISasActivationService activationService,
        ILogger<SasActivationsController> logger)
    {
        _activationService = activationService;
        _logger = logger;
    }
    
    /// <summary>
    /// Test: Enqueue a dummy activation
    /// </summary>
    [HttpPost("test/{integrationId}")]
    public async Task<IActionResult> TestActivation(int integrationId, [FromBody] TestActivationRequest request)
    {
        try
        {
            var jobId = await _activationService.EnqueueActivationAsync(
                integrationId,
                request.IntegrationName ?? "Test Integration",
                request.UserId,
                request.Username ?? "test_user",
                new { 
                    action = "activate",
                    timestamp = DateTime.UtcNow,
                    data = request.Data
                });
            
            return Ok(new { jobId, message = "Activation enqueued successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enqueue test activation");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Get activation logs for an integration
    /// </summary>
    [HttpGet("{integrationId}")]
    public async Task<IActionResult> GetActivationLogs(
        int integrationId, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null)
    {
        try
        {
            var logs = await _activationService.GetActivationLogsAsync(integrationId, page, pageSize, search);
            return Ok(logs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get activation logs for integration {integrationId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Get a single activation log
    /// </summary>
    [HttpGet("log/{logId}")]
    public async Task<IActionResult> GetActivationLog(int logId)
    {
        try
        {
            var log = await _activationService.GetActivationLogAsync(logId);
            
            if (log == null)
            {
                return NotFound(new { error = "Activation log not found" });
            }
            
            return Ok(log);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get activation log {logId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Retry all failed activations
    /// </summary>
    [HttpPost("{integrationId}/retry-failed")]
    public async Task<IActionResult> RetryFailedActivations(
        int integrationId,
        [FromQuery] string? fromDate = null)
    {
        try
        {
            DateTime? parsedDate = null;
            
            if (!string.IsNullOrEmpty(fromDate))
            {
                // Parse relative dates like "1d", "1w", "2d"
                parsedDate = ParseRelativeDate(fromDate);
            }
            
            var count = await _activationService.RetryFailedActivationsAsync(integrationId, parsedDate);
            
            return Ok(new { 
                message = $"Retrying {count} failed activations",
                count,
                fromDate = parsedDate?.ToString("O")
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to retry failed activations for integration {integrationId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Retry a single activation log
    /// </summary>
    [HttpPost("log/{logId}/retry")]
    public async Task<IActionResult> RetrySingleActivation(int logId)
    {
        try
        {
            var success = await _activationService.RetrySingleActivationAsync(logId);
            
            if (!success)
            {
                return NotFound(new { error = "Activation log not found" });
            }
            
            return Ok(new { 
                message = "Activation retry enqueued successfully",
                logId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to retry activation log {logId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Get count of retryable failed activations for a given period
    /// </summary>
    [HttpGet("{integrationId}/retry-count")]
    public async Task<IActionResult> GetRetryableCount(
        int integrationId,
        [FromQuery] string? fromDate = null)
    {
        try
        {
            DateTime? parsedDate = null;
            
            if (!string.IsNullOrEmpty(fromDate))
            {
                parsedDate = ParseRelativeDate(fromDate);
            }
            
            var count = await _activationService.GetRetryableCountAsync(integrationId, parsedDate);
            
            return Ok(new { count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get retryable count for integration {integrationId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Batch enqueue multiple activations for better performance
    /// </summary>
    [HttpPost("batch/{integrationId}")]
    public async Task<IActionResult> BatchEnqueueActivations(int integrationId, [FromBody] BatchActivationRequest request)
    {
        try
        {
            var activations = request.Activations.Select(a => (a.UserId, a.Username, (object)a.Data)).ToList();
            
            var jobIds = await _activationService.EnqueueBatchActivationsAsync(
                integrationId,
                request.IntegrationName,
                activations);
            
            return Ok(new { 
                jobIds, 
                count = jobIds.Count,
                message = $"Enqueued {jobIds.Count} activations successfully" 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enqueue batch activations");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Get activation metrics for monitoring
    /// </summary>
    [HttpGet("{integrationId}/metrics")]
    public async Task<IActionResult> GetMetrics(int integrationId, [FromQuery] string? fromDate = null)
    {
        try
        {
            DateTime? parsedDate = null;
            
            if (!string.IsNullOrEmpty(fromDate))
            {
                parsedDate = ParseRelativeDate(fromDate);
            }
            
            var metrics = await _activationService.GetMetricsAsync(integrationId, parsedDate);
            
            return Ok(metrics);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get metrics for integration {integrationId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    /// <summary>
    /// Check integration health status (circuit breaker pattern)
    /// </summary>
    [HttpGet("{integrationId}/health")]
    public async Task<IActionResult> GetHealth(int integrationId)
    {
        try
        {
            var isHealthy = await _activationService.IsIntegrationHealthyAsync(integrationId);
            
            return Ok(new { 
                integrationId,
                isHealthy,
                status = isHealthy ? "healthy" : "unhealthy",
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to check health for integration {integrationId}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
    
    private DateTime? ParseRelativeDate(string dateStr)
    {
        var now = DateTime.UtcNow;
        
        // Handle minutes format like "1min", "5min", "15min"
        if (dateStr.EndsWith("min", StringComparison.OrdinalIgnoreCase))
        {
            var minutes = int.Parse(dateStr.Replace("min", "", StringComparison.OrdinalIgnoreCase));
            return now.AddMinutes(-minutes);
        }
        // Handle hours format like "1h", "2h", "6h", "12h"
        else if (dateStr.EndsWith("h", StringComparison.OrdinalIgnoreCase))
        {
            var hours = int.Parse(dateStr.TrimEnd('h', 'H'));
            return now.AddHours(-hours);
        }
        // Handle days format like "1d", "2d", "3d"
        else if (dateStr.EndsWith("d", StringComparison.OrdinalIgnoreCase))
        {
            var days = int.Parse(dateStr.TrimEnd('d', 'D'));
            return now.AddDays(-days);
        }
        // Handle weeks format like "1w", "2w"
        else if (dateStr.EndsWith("w", StringComparison.OrdinalIgnoreCase))
        {
            var weeks = int.Parse(dateStr.TrimEnd('w', 'W'));
            return now.AddDays(-weeks * 7);
        }
        // Handle months format like "1mo", "2mo" (changed from "m" to "mo" to avoid confusion)
        else if (dateStr.EndsWith("mo", StringComparison.OrdinalIgnoreCase))
        {
            var months = int.Parse(dateStr.Replace("mo", "", StringComparison.OrdinalIgnoreCase));
            return now.AddMonths(-months);
        }
        // Legacy support for "1m" as month (but only if it's just digit + m)
        else if (dateStr.Length <= 3 && dateStr.EndsWith("m", StringComparison.OrdinalIgnoreCase) && !dateStr.EndsWith("min", StringComparison.OrdinalIgnoreCase))
        {
            var months = int.Parse(dateStr.TrimEnd('m', 'M'));
            return now.AddMonths(-months);
        }
        
        // Try parsing as ISO date
        if (DateTime.TryParse(dateStr, out var parsed))
        {
            return parsed;
        }
        
        return null;
    }
}

public class TestActivationRequest
{
    public int UserId { get; set; }
    public string? Username { get; set; }
    public string? IntegrationName { get; set; }
    public object? Data { get; set; }
}

public class BatchActivationRequest
{
    public required string IntegrationName { get; set; }
    public required List<ActivationItem> Activations { get; set; }
}

public class ActivationItem
{
    public int UserId { get; set; }
    public required string Username { get; set; }
    public object? Data { get; set; }
}
