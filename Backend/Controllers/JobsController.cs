using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Services;
using Hangfire;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class JobsController : ControllerBase
{
    private readonly IWorkspaceJobService _jobService;
    private readonly ILogger<JobsController> _logger;
    
    public JobsController(
        IWorkspaceJobService jobService,
        ILogger<JobsController> logger)
    {
        _jobService = jobService;
        _logger = logger;
    }
    
    /// <summary>
    /// Enqueue a data cleanup job
    /// </summary>
    [HttpPost("cleanup")]
    public IActionResult EnqueueCleanupJob()
    {
        var jobId = _jobService.Enqueue<IExampleJobService>(service => service.ProcessDataCleanupAsync());
        
        return Ok(new { jobId, message = "Data cleanup job enqueued successfully" });
    }
    
    /// <summary>
    /// Schedule a report generation job
    /// </summary>
    [HttpPost("reports/{reportId}")]
    public IActionResult ScheduleReportGeneration(int reportId, [FromQuery] int delayMinutes = 0)
    {
        string jobId;
        
        if (delayMinutes > 0)
        {
            jobId = _jobService.Schedule<IExampleJobService>(
                service => service.GenerateReportAsync(reportId),
                TimeSpan.FromMinutes(delayMinutes));
        }
        else
        {
            jobId = _jobService.Enqueue<IExampleJobService>(
                service => service.GenerateReportAsync(reportId));
        }
        
        return Ok(new { jobId, reportId, delayMinutes, message = "Report generation job scheduled" });
    }
    
    /// <summary>
    /// Set up a recurring sync job (runs daily at 2 AM)
    /// </summary>
    [HttpPost("sync/recurring")]
    public IActionResult SetupRecurringSyncJob()
    {
        // Cron expression for daily at 2 AM UTC
        _jobService.AddOrUpdateRecurringJob<IExampleJobService>(
            "daily-sync",
            service => service.SyncExternalDataAsync(),
            Cron.Daily(2));
        
        return Ok(new { message = "Recurring sync job configured successfully" });
    }
    
    /// <summary>
    /// Remove a recurring job
    /// </summary>
    [HttpDelete("recurring/{jobId}")]
    public IActionResult RemoveRecurringJob(string jobId)
    {
        _jobService.RemoveRecurringJob(jobId);
        
        return Ok(new { message = $"Recurring job '{jobId}' removed successfully" });
    }
    
    /// <summary>
    /// Trigger sync job immediately
    /// </summary>
    [HttpPost("sync/now")]
    public IActionResult TriggerSyncNow()
    {
        var jobId = _jobService.Enqueue<IExampleJobService>(service => service.SyncExternalDataAsync());
        
        return Ok(new { jobId, message = "Sync job triggered successfully" });
    }
}
