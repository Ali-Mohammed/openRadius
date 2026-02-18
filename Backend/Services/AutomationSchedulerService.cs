using Backend.Data;
using Backend.Models;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Backend.Services;

/// <summary>
/// Interface for managing Hangfire jobs for scheduled automations.
/// Handles registration, update, and removal of recurring and delayed jobs.
/// </summary>
public interface IAutomationSchedulerService
{
    /// <summary>
    /// Registers or updates the Hangfire job for a scheduled automation.
    /// For periodic: creates a recurring job with cron expression.
    /// For at_time: schedules a one-time delayed job.
    /// </summary>
    Task SyncAutomationJobAsync(Automation automation);

    /// <summary>
    /// Removes the Hangfire job(s) for an automation (on delete/deactivate/trigger type change).
    /// </summary>
    Task RemoveAutomationJobAsync(int automationId);

    /// <summary>
    /// Registers all active scheduled automations on application startup.
    /// Called once per workspace during Hangfire server initialization.
    /// </summary>
    Task RegisterAllScheduledAutomationsAsync(int workspaceId, string connectionString);

    /// <summary>
    /// Hangfire entry point: executes a scheduled automation by firing its workflow.
    /// Creates its own DbContext since Hangfire jobs run outside HTTP scope.
    /// </summary>
    Task ExecuteScheduledAutomationAsync(int automationId, int workspaceId, string connectionString);
}

/// <summary>
/// Manages Hangfire jobs for automations with TriggerType = "scheduled".
/// 
/// Scheduling strategies:
/// - periodic + CronExpression: RecurringJob with the cron expression
/// - periodic + ScheduleIntervalMinutes (no cron): RecurringJob with auto-generated cron (* /N * * * *)
/// - at_time + ScheduledTime: BackgroundJob.Schedule with delay until the target time
/// 
/// Job naming convention: automation_{automationId}
/// Workspace-scoped via WorkspaceJobService (prefixed as workspace_{workspaceId}_automation_{automationId})
/// </summary>
public class AutomationSchedulerService : IAutomationSchedulerService
{
    private readonly ILogger<AutomationSchedulerService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILoggerFactory _loggerFactory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public AutomationSchedulerService(
        ILogger<AutomationSchedulerService> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILoggerFactory loggerFactory)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _loggerFactory = loggerFactory;
    }

    /// <inheritdoc />
    public async Task SyncAutomationJobAsync(Automation automation)
    {
        // If this automation is not scheduled, remove any existing job and return
        if (automation.TriggerType != "scheduled" || !automation.IsActive || automation.IsDeleted || automation.Status != "active")
        {
            await RemoveAutomationJobAsync(automation.Id);
            return;
        }

        // We need the workspace context to register the job — scheduled automations
        // are registered at startup via RegisterAllScheduledAutomationsAsync.
        // This method is called from the controller where we don't have direct access
        // to workspace connection string, so we'll use the controller-level overload.
        _logger.LogInformation(
            "Automation {AutomationId} '{Title}' sync requested (ScheduleType: {ScheduleType})",
            automation.Id, automation.Title, automation.ScheduleType);
    }

    /// <summary>
    /// Registers or updates the Hangfire job for a scheduled automation using explicit workspace context.
    /// Called from the controller where tenant info is available.
    /// </summary>
    public void SyncAutomationJob(Automation automation, int workspaceId, string connectionString)
    {
        if (automation.TriggerType != "scheduled" || !automation.IsActive || automation.IsDeleted || automation.Status != "active")
        {
            RemoveAutomationJob(automation.Id, workspaceId, connectionString);
            return;
        }

        var jobId = $"automation_{automation.Id}";
        var workspaceJobId = $"workspace_{workspaceId}_{jobId}";

        var storageOptions = new PostgreSqlStorageOptions { SchemaName = "hangfire" };
        var storage = new PostgreSqlStorage(
            new Hangfire.PostgreSql.Factories.NpgsqlConnectionFactory(connectionString, storageOptions),
            storageOptions);
        var recurringJobManager = new RecurringJobManager(storage);

        if (automation.ScheduleType == "periodic")
        {
            var cronExpression = ResolveCronExpression(automation);
            if (string.IsNullOrEmpty(cronExpression))
            {
                _logger.LogWarning(
                    "Automation {AutomationId} has periodic schedule but no cron expression or interval",
                    automation.Id);
                return;
            }

            recurringJobManager.AddOrUpdate<IAutomationSchedulerService>(
                workspaceJobId,
                service => service.ExecuteScheduledAutomationAsync(automation.Id, workspaceId, connectionString),
                cronExpression,
                new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

            _logger.LogInformation(
                "Registered recurring job '{JobId}' for automation '{Title}' (cron: {Cron})",
                workspaceJobId, automation.Title, cronExpression);
        }
        else if (automation.ScheduleType == "at_time")
        {
            if (!automation.ScheduledTime.HasValue)
            {
                _logger.LogWarning(
                    "Automation {AutomationId} has at_time schedule but no ScheduledTime set",
                    automation.Id);
                return;
            }

            // Remove any existing recurring job (in case schedule type changed)
            try { recurringJobManager.RemoveIfExists(workspaceJobId); } catch { /* ignore */ }

            var delay = automation.ScheduledTime.Value - DateTime.UtcNow;
            if (delay <= TimeSpan.Zero)
            {
                _logger.LogWarning(
                    "Automation {AutomationId} ScheduledTime {ScheduledTime} is in the past, skipping",
                    automation.Id, automation.ScheduledTime.Value);
                return;
            }

            var client = new BackgroundJobClient(storage);
            client.Schedule<IAutomationSchedulerService>(
                service => service.ExecuteScheduledAutomationAsync(automation.Id, workspaceId, connectionString),
                delay);

            _logger.LogInformation(
                "Scheduled one-time job for automation '{Title}' at {ScheduledTime} (in {Delay})",
                automation.Title, automation.ScheduledTime.Value, delay);
        }
    }

    /// <summary>
    /// Removes recurring job for an automation using explicit workspace context.
    /// </summary>
    public void RemoveAutomationJob(int automationId, int workspaceId, string connectionString)
    {
        var jobId = $"workspace_{workspaceId}_automation_{automationId}";

        try
        {
            var storageOptions = new PostgreSqlStorageOptions { SchemaName = "hangfire" };
            var storage = new PostgreSqlStorage(
                new Hangfire.PostgreSql.Factories.NpgsqlConnectionFactory(connectionString, storageOptions),
                storageOptions);
            var recurringJobManager = new RecurringJobManager(storage);

            recurringJobManager.RemoveIfExists(jobId);
            _logger.LogInformation("Removed recurring job '{JobId}'", jobId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to remove recurring job '{JobId}'", jobId);
        }
    }

    /// <inheritdoc />
    public Task RemoveAutomationJobAsync(int automationId)
    {
        _logger.LogInformation("RemoveAutomationJobAsync called for automation {AutomationId} — cleanup deferred to explicit call", automationId);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task RegisterAllScheduledAutomationsAsync(int workspaceId, string connectionString)
    {
        try
        {
            _logger.LogInformation("Registering scheduled automations for workspace {WorkspaceId}", workspaceId);

            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString);
            using var context = new ApplicationDbContext(optionsBuilder.Options, null!);

            var scheduledAutomations = await context.Automations
                .Where(a => a.TriggerType == "scheduled"
                         && a.Status == "active"
                         && a.IsActive
                         && !a.IsDeleted)
                .ToListAsync();

            if (!scheduledAutomations.Any())
            {
                _logger.LogInformation("No scheduled automations found for workspace {WorkspaceId}", workspaceId);
                return;
            }

            foreach (var automation in scheduledAutomations)
            {
                try
                {
                    SyncAutomationJob(automation, workspaceId, connectionString);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Failed to register scheduled automation {AutomationId} '{Title}' for workspace {WorkspaceId}",
                        automation.Id, automation.Title, workspaceId);
                }
            }

            _logger.LogInformation(
                "Registered {Count} scheduled automations for workspace {WorkspaceId}",
                scheduledAutomations.Count, workspaceId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register scheduled automations for workspace {WorkspaceId}", workspaceId);
        }
    }

    /// <inheritdoc />
    public async Task ExecuteScheduledAutomationAsync(int automationId, int workspaceId, string connectionString)
    {
        _logger.LogInformation(
            "[Hangfire] Executing scheduled automation {AutomationId} for workspace {WorkspaceId}",
            automationId, workspaceId);

        try
        {
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString);
            using var context = new ApplicationDbContext(optionsBuilder.Options, null!);

            var automation = await context.Automations
                .FirstOrDefaultAsync(a => a.Id == automationId && !a.IsDeleted);

            if (automation == null)
            {
                _logger.LogWarning(
                    "[Hangfire] Automation {AutomationId} not found or deleted, removing job",
                    automationId);
                RemoveAutomationJob(automationId, workspaceId, connectionString);
                return;
            }

            if (!automation.IsActive || automation.Status != "active")
            {
                _logger.LogInformation(
                    "[Hangfire] Automation {AutomationId} '{Title}' is not active, skipping execution",
                    automationId, automation.Title);
                return;
            }

            // Create a scheduled automation event
            var automationEvent = new AutomationEvent
            {
                EventType = AutomationEventType.UserCreated, // Generic — scheduled automations aren't user-specific
                TriggerType = "scheduled",
                RadiusUserId = 0,
                RadiusUserUuid = Guid.Empty,
                RadiusUsername = "system",
                PerformedBy = "Hangfire Scheduler",
                IpAddress = "127.0.0.1",
                OccurredAt = DateTime.UtcNow,
                Context = new Dictionary<string, object?>
                {
                    ["automationId"] = automation.Id,
                    ["automationTitle"] = automation.Title,
                    ["scheduleType"] = automation.ScheduleType,
                    ["triggerSource"] = "hangfire_scheduled"
                }
            };

            var serializedEvent = JsonSerializer.Serialize(automationEvent, JsonOptions);

            // Use the AutomationEngineService's Hangfire-compatible entry point
            var engineService = new AutomationEngineService(
                context,
                _loggerFactory.CreateLogger<AutomationEngineService>(),
                _httpClientFactory,
                _configuration);

            await engineService.ProcessAutomationEventAsync(serializedEvent, workspaceId, connectionString);

            _logger.LogInformation(
                "[Hangfire] Successfully executed scheduled automation {AutomationId} '{Title}'",
                automationId, automation.Title);

            // For at_time automations, deactivate after execution (one-shot)
            if (automation.ScheduleType == "at_time")
            {
                automation.Status = "paused";
                automation.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();

                _logger.LogInformation(
                    "[Hangfire] Paused at_time automation {AutomationId} '{Title}' after one-time execution",
                    automationId, automation.Title);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[Hangfire] Failed to execute scheduled automation {AutomationId} for workspace {WorkspaceId}",
                automationId, workspaceId);
            throw; // Let Hangfire handle retry
        }
    }

    /// <summary>
    /// Resolves the cron expression for a periodic automation.
    /// Uses CronExpression if set, otherwise generates from ScheduleIntervalMinutes.
    /// </summary>
    private static string? ResolveCronExpression(Automation automation)
    {
        if (!string.IsNullOrEmpty(automation.CronExpression))
            return automation.CronExpression;

        if (automation.ScheduleIntervalMinutes.HasValue && automation.ScheduleIntervalMinutes.Value > 0)
        {
            var minutes = automation.ScheduleIntervalMinutes.Value;

            // Standard cron patterns for common intervals
            return minutes switch
            {
                1 => "* * * * *",           // Every minute
                5 => "*/5 * * * *",         // Every 5 minutes
                10 => "*/10 * * * *",       // Every 10 minutes
                15 => "*/15 * * * *",       // Every 15 minutes
                30 => "*/30 * * * *",       // Every 30 minutes
                60 => "0 * * * *",          // Every hour
                120 => "0 */2 * * *",       // Every 2 hours
                360 => "0 */6 * * *",       // Every 6 hours
                720 => "0 */12 * * *",      // Every 12 hours
                1440 => "0 0 * * *",        // Every day
                _ => $"*/{minutes} * * * *" // Generic: every N minutes
            };
        }

        return null;
    }
}
