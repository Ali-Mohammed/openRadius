using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Backend.Services;

/// <summary>
/// Interface for the user lifecycle event service that detects expired and churned users
/// and fires the corresponding automation events.
/// </summary>
public interface IUserLifecycleEventService
{
    /// <summary>
    /// Hangfire entry point: scans for newly expired users and fires user-expired automation events.
    /// Creates its own DbContext since Hangfire jobs run outside HTTP scope.
    /// </summary>
    Task DetectExpiredUsersAsync(int workspaceId, string connectionString);

    /// <summary>
    /// Hangfire entry point: scans for churned users (expired for more than the churn threshold)
    /// and fires user-churned automation events.
    /// Creates its own DbContext since Hangfire jobs run outside HTTP scope.
    /// </summary>
    Task DetectChurnedUsersAsync(int workspaceId, string connectionString);
}

/// <summary>
/// Detects user lifecycle transitions (expiration, churn) and fires corresponding automation events.
/// 
/// Runs as Hangfire recurring jobs (registered per workspace at startup):
/// - Expired user detection: every 5 minutes, finds users whose Expiration has passed
/// - Churned user detection: every hour, finds users expired for more than N days (default 30)
/// 
/// Deduplication strategy:
/// - Queries AutomationExecutionLogs to find users who already had the event fired
/// - Only fires events for users not yet processed
/// - Uses batch processing to minimize DB load
/// </summary>
public class UserLifecycleEventService : IUserLifecycleEventService
{
    private readonly ILogger<UserLifecycleEventService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILoggerFactory _loggerFactory;

    /// <summary>
    /// Number of days after expiration before a user is considered "churned".
    /// Default: 30 days.
    /// </summary>
    private const int DefaultChurnThresholdDays = 30;

    /// <summary>
    /// Maximum number of users to process per batch to prevent memory issues.
    /// </summary>
    private const int BatchSize = 100;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public UserLifecycleEventService(
        ILogger<UserLifecycleEventService> logger,
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
    public async Task DetectExpiredUsersAsync(int workspaceId, string connectionString)
    {
        _logger.LogInformation(
            "[Hangfire] Detecting expired users for workspace {WorkspaceId}",
            workspaceId);

        try
        {
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString);
            using var context = new ApplicationDbContext(optionsBuilder.Options, null!);

            // Check if any active automations have user-expired triggers
            var hasExpiredTriggerAutomation = await context.Automations
                .AnyAsync(a => a.TriggerType == "on_action"
                            && a.IsActive
                            && !a.IsDeleted
                            && a.Status == "active"
                            && a.WorkflowJson != null
                            && a.WorkflowJson.Contains("user-expired"));

            if (!hasExpiredTriggerAutomation)
            {
                _logger.LogDebug(
                    "[Hangfire] No active automations with user-expired triggers for workspace {WorkspaceId}, skipping",
                    workspaceId);
                return;
            }

            var now = DateTime.UtcNow;

            // Find users whose expiration has passed and who haven't had the event fired yet
            // Step 1: Get user IDs that already had user-expired events fired
            var alreadyFiredUserIds = await context.AutomationExecutionLogs
                .Where(l => l.TriggerType == "user-expired"
                         && l.RadiusUserId != null
                         && (l.Status == "completed" || l.Status == "completed_with_errors"))
                .Select(l => l.RadiusUserId!.Value)
                .Distinct()
                .ToListAsync();

            var alreadyFiredSet = new HashSet<int>(alreadyFiredUserIds);

            // Step 2: Find expired users not yet processed
            var expiredUsers = await context.RadiusUsers
                .Where(u => u.Expiration != null
                         && u.Expiration < now
                         && !u.IsDeleted)
                .OrderBy(u => u.Expiration)
                .Take(BatchSize)
                .Select(u => new { u.Id, u.Uuid, u.Username, u.Expiration, u.Email, u.Phone, u.Balance, u.ProfileId, u.GroupId, u.ZoneId, u.Enabled })
                .ToListAsync();

            var newExpiredUsers = expiredUsers.Where(u => !alreadyFiredSet.Contains(u.Id)).ToList();

            if (!newExpiredUsers.Any())
            {
                _logger.LogDebug(
                    "[Hangfire] No new expired users found for workspace {WorkspaceId}",
                    workspaceId);
                return;
            }

            _logger.LogInformation(
                "[Hangfire] Found {Count} newly expired users for workspace {WorkspaceId}",
                newExpiredUsers.Count, workspaceId);

            // Fire events for each expired user
            var engineService = new AutomationEngineService(
                context,
                _loggerFactory.CreateLogger<AutomationEngineService>(),
                _httpClientFactory,
                _configuration);

            foreach (var user in newExpiredUsers)
            {
                try
                {
                    var automationEvent = new AutomationEvent
                    {
                        EventType = AutomationEventType.UserExpired,
                        TriggerType = AutomationEvent.GetTriggerTypeString(AutomationEventType.UserExpired),
                        RadiusUserId = user.Id,
                        RadiusUserUuid = user.Uuid,
                        RadiusUsername = user.Username,
                        PerformedBy = "System (Lifecycle Detection)",
                        IpAddress = "127.0.0.1",
                        OccurredAt = DateTime.UtcNow,
                        Context = new Dictionary<string, object?>
                        {
                            ["username"] = user.Username,
                            ["email"] = user.Email,
                            ["phone"] = user.Phone,
                            ["enabled"] = user.Enabled,
                            ["balance"] = user.Balance,
                            ["profileId"] = user.ProfileId,
                            ["expiration"] = user.Expiration?.ToString("O"),
                            ["groupId"] = user.GroupId,
                            ["zoneId"] = user.ZoneId,
                            ["triggerSource"] = "lifecycle_expired_detection"
                        }
                    };

                    var serializedEvent = JsonSerializer.Serialize(automationEvent, JsonOptions);
                    await engineService.ProcessAutomationEventAsync(serializedEvent, workspaceId, connectionString);

                    _logger.LogInformation(
                        "[Hangfire] Fired user-expired event for user {Username} (ID: {UserId}) in workspace {WorkspaceId}",
                        user.Username, user.Id, workspaceId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "[Hangfire] Failed to fire user-expired event for user {Username} (ID: {UserId})",
                        user.Username, user.Id);
                    // Continue processing remaining users
                }
            }

            _logger.LogInformation(
                "[Hangfire] Completed expired user detection for workspace {WorkspaceId}: processed {Count} users",
                workspaceId, newExpiredUsers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[Hangfire] Failed to detect expired users for workspace {WorkspaceId}",
                workspaceId);
            throw; // Let Hangfire handle retry
        }
    }

    /// <inheritdoc />
    public async Task DetectChurnedUsersAsync(int workspaceId, string connectionString)
    {
        _logger.LogInformation(
            "[Hangfire] Detecting churned users for workspace {WorkspaceId}",
            workspaceId);

        try
        {
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString);
            using var context = new ApplicationDbContext(optionsBuilder.Options, null!);

            // Check if any active automations have user-churned triggers
            var hasChurnedTriggerAutomation = await context.Automations
                .AnyAsync(a => a.TriggerType == "on_action"
                            && a.IsActive
                            && !a.IsDeleted
                            && a.Status == "active"
                            && a.WorkflowJson != null
                            && a.WorkflowJson.Contains("user-churned"));

            if (!hasChurnedTriggerAutomation)
            {
                _logger.LogDebug(
                    "[Hangfire] No active automations with user-churned triggers for workspace {WorkspaceId}, skipping",
                    workspaceId);
                return;
            }

            var churnThresholdDays = _configuration.GetValue("Automation:ChurnThresholdDays", DefaultChurnThresholdDays);
            var churnCutoff = DateTime.UtcNow.AddDays(-churnThresholdDays);

            // Find users who have already had user-churned events fired
            var alreadyChurnedUserIds = await context.AutomationExecutionLogs
                .Where(l => l.TriggerType == "user-churned"
                         && l.RadiusUserId != null
                         && (l.Status == "completed" || l.Status == "completed_with_errors"))
                .Select(l => l.RadiusUserId!.Value)
                .Distinct()
                .ToListAsync();

            var alreadyChurnedSet = new HashSet<int>(alreadyChurnedUserIds);

            // Find users whose expiration passed more than churnThresholdDays ago
            var churnedUsers = await context.RadiusUsers
                .Where(u => u.Expiration != null
                         && u.Expiration < churnCutoff
                         && !u.IsDeleted)
                .OrderBy(u => u.Expiration)
                .Take(BatchSize)
                .Select(u => new { u.Id, u.Uuid, u.Username, u.Expiration, u.Email, u.Phone, u.Balance, u.ProfileId, u.GroupId, u.ZoneId, u.Enabled })
                .ToListAsync();

            var newChurnedUsers = churnedUsers.Where(u => !alreadyChurnedSet.Contains(u.Id)).ToList();

            if (!newChurnedUsers.Any())
            {
                _logger.LogDebug(
                    "[Hangfire] No new churned users found for workspace {WorkspaceId}",
                    workspaceId);
                return;
            }

            _logger.LogInformation(
                "[Hangfire] Found {Count} newly churned users (expired > {Threshold} days) for workspace {WorkspaceId}",
                newChurnedUsers.Count, churnThresholdDays, workspaceId);

            var engineService = new AutomationEngineService(
                context,
                _loggerFactory.CreateLogger<AutomationEngineService>(),
                _httpClientFactory,
                _configuration);

            foreach (var user in newChurnedUsers)
            {
                try
                {
                    var daysExpired = (DateTime.UtcNow - user.Expiration!.Value).Days;

                    var automationEvent = new AutomationEvent
                    {
                        EventType = AutomationEventType.UserChurned,
                        TriggerType = AutomationEvent.GetTriggerTypeString(AutomationEventType.UserChurned),
                        RadiusUserId = user.Id,
                        RadiusUserUuid = user.Uuid,
                        RadiusUsername = user.Username,
                        PerformedBy = "System (Lifecycle Detection)",
                        IpAddress = "127.0.0.1",
                        OccurredAt = DateTime.UtcNow,
                        Context = new Dictionary<string, object?>
                        {
                            ["username"] = user.Username,
                            ["email"] = user.Email,
                            ["phone"] = user.Phone,
                            ["enabled"] = user.Enabled,
                            ["balance"] = user.Balance,
                            ["profileId"] = user.ProfileId,
                            ["expiration"] = user.Expiration?.ToString("O"),
                            ["groupId"] = user.GroupId,
                            ["zoneId"] = user.ZoneId,
                            ["daysExpired"] = daysExpired,
                            ["churnThresholdDays"] = churnThresholdDays,
                            ["triggerSource"] = "lifecycle_churn_detection"
                        }
                    };

                    var serializedEvent = JsonSerializer.Serialize(automationEvent, JsonOptions);
                    await engineService.ProcessAutomationEventAsync(serializedEvent, workspaceId, connectionString);

                    _logger.LogInformation(
                        "[Hangfire] Fired user-churned event for user {Username} (ID: {UserId}, expired {Days} days ago) in workspace {WorkspaceId}",
                        user.Username, user.Id, daysExpired, workspaceId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "[Hangfire] Failed to fire user-churned event for user {Username} (ID: {UserId})",
                        user.Username, user.Id);
                }
            }

            _logger.LogInformation(
                "[Hangfire] Completed churned user detection for workspace {WorkspaceId}: processed {Count} users",
                workspaceId, newChurnedUsers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[Hangfire] Failed to detect churned users for workspace {WorkspaceId}",
                workspaceId);
            throw;
        }
    }
}
