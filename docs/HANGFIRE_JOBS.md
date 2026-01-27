# Hangfire Background Jobs - Implementation Guide

## Overview

OpenRadius uses **Hangfire** for background job processing. Each workspace has its own isolated Hangfire instance using the workspace's PostgreSQL database.

## Features

- ✅ **Per-Workspace Isolation**: Each workspace has its own job queue and storage
- ✅ **Persistent Storage**: Jobs stored in PostgreSQL (survives restarts)
- ✅ **Automatic Retry**: Failed jobs are automatically retried
- ✅ **Dashboard UI**: Monitor jobs at `/hangfire` endpoint
- ✅ **Three Job Types**: Fire-and-forget, Delayed, and Recurring jobs

## Architecture

### Workspace Isolation

Each workspace uses:
- **Dedicated Schema**: `hangfire` schema in workspace database
- **Isolated Queue**: `workspace_{workspaceId}` queue name
- **Separate Job Client**: Configured per workspace context

### Database Schema

Hangfire automatically creates these tables in each workspace database:
- `hangfire.job` - Job definitions
- `hangfire.state` - Job state transitions
- `hangfire.jobqueue` - Job queue
- `hangfire.hash`, `hangfire.list`, `hangfire.set` - Internal storage

## Usage Examples

### 1. Fire-and-Forget Jobs

Execute a job once in the background:

```csharp
public class MyController : ControllerBase
{
    private readonly IWorkspaceJobService _jobService;
    
    [HttpPost("process")]
    public IActionResult ProcessData()
    {
        var jobId = _jobService.Enqueue<IExampleJobService>(
            service => service.ProcessDataCleanupAsync());
        
        return Ok(new { jobId });
    }
}
```

### 2. Delayed Jobs

Schedule a job to run after a delay:

```csharp
[HttpPost("reports/{id}")]
public IActionResult GenerateReport(int id)
{
    // Run after 30 minutes
    var jobId = _jobService.Schedule<IExampleJobService>(
        service => service.GenerateReportAsync(id),
        TimeSpan.FromMinutes(30));
    
    return Ok(new { jobId });
}
```

### 3. Recurring Jobs

Schedule jobs to run on a schedule:

```csharp
[HttpPost("setup-daily-sync")]
public IActionResult SetupDailySync()
{
    // Run daily at 2 AM UTC
    _jobService.AddOrUpdateRecurringJob<IExampleJobService>(
        "daily-sync",
        service => service.SyncExternalDataAsync(),
        Cron.Daily(2));
    
    return Ok();
}
```

#### Common Cron Expressions

```csharp
Cron.Minutely()                    // Every minute
Cron.Hourly()                      // Every hour
Cron.Daily()                       // Daily at midnight
Cron.Daily(2)                      // Daily at 2 AM
Cron.Weekly()                      // Weekly on Monday
Cron.Monthly()                     // Monthly on 1st day
Cron.Yearly()                      // Yearly on January 1st
"0 */6 * * *"                      // Every 6 hours
"*/15 * * * *"                     // Every 15 minutes
"0 0 * * 0"                        // Every Sunday at midnight
```

## Creating a New Job Service

### Step 1: Define the Service Interface

```csharp
namespace Backend.Services;

public interface IMyJobService
{
    Task ProcessOrdersAsync();
    Task SendEmailNotificationAsync(int userId, string message);
}
```

### Step 2: Implement the Service

```csharp
public class MyJobService : IMyJobService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MyJobService> _logger;
    
    public MyJobService(
        ApplicationDbContext context,
        ILogger<MyJobService> logger)
    {
        _context = context;
        _logger = logger;
    }
    
    public async Task ProcessOrdersAsync()
    {
        _logger.LogInformation("Processing orders...");
        
        var pendingOrders = await _context.Orders
            .Where(o => o.Status == "pending")
            .ToListAsync();
        
        foreach (var order in pendingOrders)
        {
            // Process order logic
            order.Status = "processed";
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation($"Processed {pendingOrders.Count} orders");
    }
    
    public async Task SendEmailNotificationAsync(int userId, string message)
    {
        _logger.LogInformation($"Sending email to user {userId}");
        
        // Email sending logic here
        await Task.Delay(100); // Simulate work
        
        _logger.LogInformation($"Email sent to user {userId}");
    }
}
```

### Step 3: Register the Service

In `Program.cs`:

```csharp
builder.Services.AddScoped<IMyJobService, MyJobService>();
```

### Step 4: Use the Service

```csharp
public class OrdersController : ControllerBase
{
    private readonly IWorkspaceJobService _jobService;
    
    [HttpPost("process-orders")]
    public IActionResult ProcessOrders()
    {
        var jobId = _jobService.Enqueue<IMyJobService>(
            service => service.ProcessOrdersAsync());
        
        return Ok(new { jobId });
    }
    
    [HttpPost("notify/{userId}")]
    public IActionResult NotifyUser(int userId, [FromBody] string message)
    {
        var jobId = _jobService.Enqueue<IMyJobService>(
            service => service.SendEmailNotificationAsync(userId, message));
        
        return Ok(new { jobId });
    }
}
```

## Hangfire Dashboard

Access the dashboard at: **`http://localhost:5000/hangfire`**

The dashboard shows:
- **Jobs**: All enqueued, processing, succeeded, and failed jobs
- **Recurring Jobs**: Scheduled recurring jobs
- **Servers**: Active Hangfire servers
- **Retries**: Failed jobs waiting for retry

### Dashboard Authentication

The dashboard requires authentication. Only logged-in users can access it.

## Best Practices

### 1. Keep Jobs Idempotent

Jobs should be safe to run multiple times:

```csharp
public async Task ProcessPaymentAsync(int paymentId)
{
    var payment = await _context.Payments.FindAsync(paymentId);
    
    // Check if already processed
    if (payment.Status == "processed")
    {
        _logger.LogInformation($"Payment {paymentId} already processed");
        return;
    }
    
    // Process payment
    payment.Status = "processed";
    await _context.SaveChangesAsync();
}
```

### 2. Use Appropriate Job Types

- **Fire-and-forget**: Quick background tasks (emails, notifications)
- **Delayed**: Tasks that need to run after a specific time
- **Recurring**: Scheduled maintenance, syncs, reports

### 3. Handle Exceptions Properly

```csharp
public async Task ProcessDataAsync()
{
    try
    {
        // Your logic here
        await DoWorkAsync();
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error processing data");
        throw; // Hangfire will handle retry
    }
}
```

### 4. Monitor Job Performance

Use logging to track job execution:

```csharp
public async Task LongRunningJobAsync()
{
    var sw = System.Diagnostics.Stopwatch.StartNew();
    _logger.LogInformation("Starting long running job");
    
    await DoWorkAsync();
    
    sw.Stop();
    _logger.LogInformation($"Job completed in {sw.ElapsedMilliseconds}ms");
}
```

### 5. Use Cancellation Tokens

For long-running jobs:

```csharp
public async Task ProcessLargeDatasetAsync(CancellationToken cancellationToken)
{
    var items = await _context.Items.ToListAsync(cancellationToken);
    
    foreach (var item in items)
    {
        cancellationToken.ThrowIfCancellationRequested();
        
        // Process item
        await ProcessItemAsync(item, cancellationToken);
    }
}
```

## API Endpoints

The `JobsController` provides these endpoints:

- `POST /api/jobs/cleanup` - Enqueue data cleanup job
- `POST /api/jobs/reports/{reportId}?delayMinutes=30` - Schedule report generation
- `POST /api/jobs/sync/recurring` - Setup recurring sync job
- `POST /api/jobs/sync/now` - Trigger sync immediately
- `DELETE /api/jobs/recurring/{jobId}` - Remove recurring job

## Configuration

### Worker Count

In `Program.cs`, the worker count is set to `Environment.ProcessorCount * 2`:

```csharp
builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount * 2;
    options.ServerName = $"OpenRadius-{Environment.MachineName}";
});
```

### Storage Options

Hangfire uses PostgreSQL with these options:

```csharp
new PostgreSqlStorageOptions
{
    SchemaName = "hangfire"
}
```

## Troubleshooting

### Jobs Not Running

1. Check the Hangfire dashboard at `/hangfire`
2. Verify the workspace database has the `hangfire` schema
3. Check logs for exceptions
4. Ensure the Hangfire server is running

### Database Connection Issues

```csharp
// Verify connection string in WorkspaceJobService
_logger.LogInformation($"Using connection: {tenantInfo.ConnectionString}");
```

### Performance Issues

- Reduce worker count if CPU usage is high
- Monitor job duration in logs
- Consider breaking large jobs into smaller chunks

## Additional Resources

- [Hangfire Documentation](https://docs.hangfire.io/)
- [Cron Expression Generator](https://crontab.guru/)
- [PostgreSQL Storage Documentation](https://github.com/hangfireio/Hangfire.PostgreSql)
