using Hangfire;
using Hangfire.PostgreSql;
using Hangfire.States;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Backend.Models;

namespace Backend.Services;

public interface IWorkspaceJobService
{
    /// <summary>
    /// Enqueue a background job for the current workspace
    /// </summary>
    string Enqueue<T>(System.Linq.Expressions.Expression<Action<T>> methodCall);
    
    /// <summary>
    /// Enqueue a background job with a specific queue name (for concurrency control)
    /// </summary>
    string Enqueue<T>(System.Linq.Expressions.Expression<Action<T>> methodCall, string queueName);
    
    /// <summary>
    /// Schedule a background job for the current workspace
    /// </summary>
    string Schedule<T>(System.Linq.Expressions.Expression<Action<T>> methodCall, TimeSpan delay);
    
    /// <summary>
    /// Schedule a recurring job for the current workspace
    /// </summary>
    void AddOrUpdateRecurringJob<T>(string jobId, System.Linq.Expressions.Expression<Action<T>> methodCall, string cronExpression);
    
    /// <summary>
    /// Remove a recurring job for the current workspace
    /// </summary>
    void RemoveRecurringJob(string jobId);
    
    /// <summary>
    /// Get the Hangfire job client configured for the current workspace
    /// </summary>
    IBackgroundJobClient GetJobClient();
    
    /// <summary>
    /// Get a queue name for integration-specific concurrency control
    /// </summary>
    string GetIntegrationQueue(int integrationId, int maxConcurrency);
}

public class WorkspaceJobService : IWorkspaceJobService
{
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;
    private readonly ILogger<WorkspaceJobService> _logger;
    
    public WorkspaceJobService(
        IMultiTenantContextAccessor<WorkspaceTenantInfo> tenantAccessor,
        ILogger<WorkspaceJobService> logger)
    {
        _tenantAccessor = tenantAccessor;
        _logger = logger;
    }
    
    private string GetWorkspaceQueue()
    {
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        return $"workspace_{tenantInfo.WorkspaceId}";
    }
    
    private IBackgroundJobClient GetWorkspaceJobClient()
    {
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        // Configure Hangfire storage for this workspace
        var storage = new PostgreSqlStorage(
            tenantInfo.ConnectionString,
            new PostgreSqlStorageOptions
            {
                SchemaName = "hangfire"
            });
        
        return new BackgroundJobClient(storage);
    }
    
    public IBackgroundJobClient GetJobClient()
    {
        return GetWorkspaceJobClient();
    }
    
    public string Enqueue<T>(System.Linq.Expressions.Expression<Action<T>> methodCall)
    {
        var client = GetWorkspaceJobClient();
        var queue = GetWorkspaceQueue();
        
        _logger.LogInformation($"Enqueuing job for workspace queue: {queue}");
        
        return client.Enqueue(methodCall);
    }
    
    public string Enqueue<T>(System.Linq.Expressions.Expression<Action<T>> methodCall, string queueName)
    {
        var client = GetWorkspaceJobClient();
        
        _logger.LogInformation($"Enqueuing job for queue: {queueName}");
        
        return client.Create(methodCall, new EnqueuedState(queueName));
    }
    
    public string GetIntegrationQueue(int integrationId, int maxConcurrency)
    {
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        // For sequential processing (maxConcurrency=1), use integration-specific queue
        // For parallel processing, use workspace queue to allow concurrent jobs
        if (maxConcurrency == 1)
        {
            return $"workspace_{tenantInfo.WorkspaceId}_integration_{integrationId}";
        }
        else
        {
            // Use workspace queue for parallel processing
            // Hangfire worker count will limit actual concurrency
            return $"workspace_{tenantInfo.WorkspaceId}";
        }
    }
    
    public string Schedule<T>(System.Linq.Expressions.Expression<Action<T>> methodCall, TimeSpan delay)
    {
        var client = GetWorkspaceJobClient();
        var queue = GetWorkspaceQueue();
        
        _logger.LogInformation($"Scheduling job for workspace queue: {queue} with delay: {delay}");
        
        return client.Schedule(methodCall, delay);
    }
    
    public void AddOrUpdateRecurringJob<T>(string jobId, System.Linq.Expressions.Expression<Action<T>> methodCall, string cronExpression)
    {
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        var workspaceJobId = $"workspace_{tenantInfo.WorkspaceId}_{jobId}";
        var queue = GetWorkspaceQueue();
        
        _logger.LogInformation($"Adding/updating recurring job '{workspaceJobId}' for workspace queue: {queue}");
        
        // Configure storage for this workspace
        var storage = new PostgreSqlStorage(
            tenantInfo.ConnectionString,
            new PostgreSqlStorageOptions
            {
                SchemaName = "hangfire"
            });
        
        using var connection = storage.GetConnection();
        var recurringJobManager = new RecurringJobManager(storage);
        
        recurringJobManager.AddOrUpdate(
            workspaceJobId,
            methodCall,
            cronExpression,
            new RecurringJobOptions
            {
                TimeZone = TimeZoneInfo.Utc
            });
    }
    
    public void RemoveRecurringJob(string jobId)
    {
        var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
        {
            throw new InvalidOperationException("No tenant context available");
        }
        
        var workspaceJobId = $"workspace_{tenantInfo.WorkspaceId}_{jobId}";
        
        _logger.LogInformation($"Removing recurring job: {workspaceJobId}");
        
        RecurringJob.RemoveIfExists(workspaceJobId);
    }
}
