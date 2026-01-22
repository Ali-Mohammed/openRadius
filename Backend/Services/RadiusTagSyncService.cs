using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Helpers;
using Backend.Hubs;
using Backend.Models;

namespace Backend.Services;

public class RadiusTagSyncService : IRadiusTagSyncService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<TagSyncHub> _hubContext;
    private readonly ILogger<RadiusTagSyncService> _logger;

    public RadiusTagSyncService(
        IServiceScopeFactory scopeFactory,
        IHubContext<TagSyncHub> hubContext,
        ILogger<RadiusTagSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<TagSyncResult> SyncTagsAsync(string? filters = null, Action<TagSyncProgress>? onProgress = null)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var result = new TagSyncResult();

        try
        {
            _logger.LogInformation("Starting RADIUS tag sync...");

            // Get or create predefined tags
            var newUserTag = await GetOrCreateTag(context, "New User", "#10b981", "UserPlus");
            var activeTag = await GetOrCreateTag(context, "Active", "#3b82f6", "CheckCircle");
            var expiredTag = await GetOrCreateTag(context, "Expired", "#ef4444", "XCircle");
            var expiringSoonTag = await GetOrCreateTag(context, "Expiring Soon", "#f59e0b", "AlertCircle");

            // Build query for radius users
            var query = context.RadiusUsers
                .Include(u => u.RadiusUserTags)
                .Where(u => !u.IsDeleted)
                .AsQueryable();

            // Apply filters if provided
            if (!string.IsNullOrEmpty(filters))
            {
                try
                {
                    var filterGroup = System.Text.Json.JsonSerializer.Deserialize<FilterGroup>(filters, 
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (filterGroup != null)
                    {
                        query = ApplyAdvancedFilters(query, filterGroup);
                        _logger.LogInformation("Applied filters to tag sync query");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to parse filters: {Error}", ex.Message);
                }
            }

            // Get all matching users
            var users = await query.ToListAsync();

            result.TotalUsers = users.Count;
            _logger.LogInformation("Found {Count} users to process", users.Count);

            ReportProgress(onProgress, "Processing", 0, users.Count, "Starting tag sync...");

            var now = DateTime.UtcNow;
            var newUserThreshold = now.AddDays(-7); // Users created in last 7 days
            var expiringSoonThreshold = now.AddDays(7); // Users expiring in next 7 days

            int processed = 0;
            foreach (var user in users)
            {
                processed++;
                var tagsChanged = false;

                // Remove all auto-assigned tags first
                var autoTags = user.RadiusUserTags
                    .Where(ut => ut.RadiusTagId == newUserTag.Id || 
                                 ut.RadiusTagId == activeTag.Id || 
                                 ut.RadiusTagId == expiredTag.Id || 
                                 ut.RadiusTagId == expiringSoonTag.Id)
                    .ToList();

                if (autoTags.Any())
                {
                    context.RadiusUserTags.RemoveRange(autoTags);
                    result.TagsRemoved += autoTags.Count;
                    tagsChanged = true;
                }

                // Determine which tags to apply
                var tagsToAdd = new List<RadiusTag>();

                // Check if new user (created in last 7 days)
                if (user.CreatedAt >= newUserThreshold)
                {
                    tagsToAdd.Add(newUserTag);
                }

                // Check expiration status
                if (user.Expiration.HasValue)
                {
                    if (user.Expiration.Value <= now)
                    {
                        // Expired
                        tagsToAdd.Add(expiredTag);
                    }
                    else if (user.Expiration.Value <= expiringSoonThreshold)
                    {
                        // Expiring soon
                        tagsToAdd.Add(expiringSoonTag);
                        tagsToAdd.Add(activeTag);
                    }
                    else
                    {
                        // Active with future expiration
                        tagsToAdd.Add(activeTag);
                    }
                }
                else
                {
                    // No expiration set - consider active
                    if (user.Enabled)
                    {
                        tagsToAdd.Add(activeTag);
                    }
                }

                // Add tags
                foreach (var tag in tagsToAdd)
                {
                    if (!user.RadiusUserTags.Any(ut => ut.RadiusTagId == tag.Id))
                    {
                        context.RadiusUserTags.Add(new RadiusUserTag
                        {
                            RadiusUserId = user.Id,
                            RadiusTagId = tag.Id,
                            AssignedAt = DateTime.UtcNow
                        });
                        result.TagsAssigned++;
                        tagsChanged = true;
                    }
                }

                if (tagsChanged)
                {
                    result.UsersProcessed++;
                }

                // Report progress every 10 users
                if (processed % 10 == 0 || processed == users.Count)
                {
                    var percentComplete = (int)((processed / (double)users.Count) * 100);
                    ReportProgress(onProgress, "Processing", processed, users.Count, 
                        $"Processed {processed} of {users.Count} users");
                    
                    // Send to SignalR clients
                    await _hubContext.Clients.All.SendAsync("TagSyncProgress", new
                    {
                        phase = "Processing",
                        current = processed,
                        total = users.Count,
                        percentComplete,
                        message = $"Processed {processed} of {users.Count} users"
                    });
                }
            }

            await context.SaveChangesAsync();

            ReportProgress(onProgress, "Complete", users.Count, users.Count, "Tag sync completed!");
            await _hubContext.Clients.All.SendAsync("TagSyncProgress", new
            {
                phase = "Complete",
                current = users.Count,
                total = users.Count,
                percentComplete = 100,
                message = "Tag sync completed!"
            });

            _logger.LogInformation("Tag sync completed. Users processed: {Processed}, Tags assigned: {Assigned}, Tags removed: {Removed}",
                result.UsersProcessed, result.TagsAssigned, result.TagsRemoved);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tag sync failed");
            result.Errors.Add($"Sync failed: {ex.Message}");
            
            await _hubContext.Clients.All.SendAsync("TagSyncError", new
            {
                message = ex.Message
            });
        }

        return result;
    }

    public async Task<TagSyncResult> SyncTagsWithRulesAsync(int workspaceId, Action<TagSyncProgress>? onProgress = null)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
        
        var result = new TagSyncResult();

        try
        {
            _logger.LogInformation("Starting RADIUS tag sync with rules for workspace {WorkspaceId}", workspaceId);

            // Get workspace and tag sync rules
            var workspace = await masterContext.Workspaces.FindAsync(workspaceId);
            if (workspace == null || string.IsNullOrEmpty(workspace.TagSyncRules))
            {
                _logger.LogWarning("No tag sync rules found for workspace {WorkspaceId}", workspaceId);
                return result;
            }

            // Parse the rules
            var rules = System.Text.Json.JsonSerializer.Deserialize<List<TagSyncRuleDto>>(workspace.TagSyncRules);
            if (rules == null || rules.Count == 0)
            {
                _logger.LogWarning("No valid tag sync rules found for workspace {WorkspaceId}", workspaceId);
                return result;
            }

            ReportProgress(onProgress, "Initializing", 0, rules.Count, "Loading tag sync rules...");
            await _hubContext.Clients.Group("TagSync").SendAsync("TagSyncProgress", new
            {
                phase = "Initializing",
                current = 0,
                total = rules.Count,
                percentComplete = 0,
                message = "Loading tag sync rules..."
            });

            // Process each rule
            for (int i = 0; i < rules.Count; i++)
            {
                var rule = rules[i];
                
                ReportProgress(onProgress, "Processing", i, rules.Count, $"Processing rule for tag: {rule.TagName}");
                await _hubContext.Clients.Group("TagSync").SendAsync("TagSyncProgress", new
                {
                    phase = "Processing",
                    current = i,
                    total = rules.Count,
                    percentComplete = (int)((i / (double)rules.Count) * 100),
                    message = $"Processing rule for tag: {rule.TagName}"
                });

                // Get the tag
                var tag = await context.RadiusTags.FirstOrDefaultAsync(t => t.Id == rule.TagId);
                if (tag == null)
                {
                    _logger.LogWarning("Tag {TagId} not found for rule {RuleId}", rule.TagId, rule.Id);
                    result.Errors.Add($"Tag '{rule.TagName}' not found");
                    continue;
                }

                // Build query for radius users
                var query = context.RadiusUsers
                    .Include(u => u.RadiusUserTags)
                    .Where(u => !u.IsDeleted)
                    .AsQueryable();

                // Apply filters if provided in the rule
                if (rule.FilterGroup != null)
                {
                    try
                    {
                        var filterJson = System.Text.Json.JsonSerializer.Serialize(rule.FilterGroup);
                        var filterGroup = System.Text.Json.JsonSerializer.Deserialize<FilterGroup>(filterJson);
                        if (filterGroup != null)
                        {
                            query = ApplyAdvancedFilters(query, filterGroup);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error parsing filters for rule {RuleId}", rule.Id);
                        result.Errors.Add($"Error parsing filters for rule '{rule.TagName}': {ex.Message}");
                        continue;
                    }
                }

                var users = await query.ToListAsync();
                result.TotalUsers += users.Count;

                // Process users for this rule
                foreach (var user in users)
                {
                    var hasTag = user.RadiusUserTags.Any(ut => ut.RadiusTagId == tag.Id);
                    
                    if (!hasTag)
                    {
                        user.RadiusUserTags.Add(new RadiusUserTag
                        {
                            RadiusUserId = user.Id,
                            RadiusTagId = tag.Id,
                            AssignedAt = DateTime.UtcNow
                        });
                        result.TagsAssigned++;
                    }
                    
                    result.UsersProcessed++;
                }

                await context.SaveChangesAsync();
            }

            ReportProgress(onProgress, "Completed", rules.Count, rules.Count, $"Tag sync completed. Processed {result.UsersProcessed} users.");
            await _hubContext.Clients.Group("TagSync").SendAsync("TagSyncProgress", new
            {
                phase = "Completed",
                current = rules.Count,
                total = rules.Count,
                percentComplete = 100,
                message = $"Tag sync completed. Processed {result.UsersProcessed} users."
            });

            _logger.LogInformation("Tag sync with rules completed. Users: {Users}, Assigned: {Assigned}", 
                result.UsersProcessed, result.TagsAssigned);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during tag sync with rules");
            result.Errors.Add(ex.Message);
            
            await _hubContext.Clients.Group("TagSync").SendAsync("TagSyncError", new
            {
                message = ex.Message
            });
        }

        return result;
    }

    private class TagSyncRuleDto
    {
        public string Id { get; set; } = "";
        public int TagId { get; set; }
        public string TagName { get; set; } = "";
        public object? FilterGroup { get; set; }
    }

    private async Task<RadiusTag> GetOrCreateTag(ApplicationDbContext context, string title, string color, string icon)
    {
        var tag = await context.RadiusTags.FirstOrDefaultAsync(t => t.Title == title);
        
        if (tag == null)
        {
            tag = new RadiusTag
            {
                Title = title,
                Description = $"Auto-assigned tag for {title.ToLower()}",
                Color = color,
                Icon = icon,
                Status = "active",
                CreatedAt = DateTime.UtcNow
            };
            context.RadiusTags.Add(tag);
            await context.SaveChangesAsync();
            _logger.LogInformation("Created new tag: {Title}", title);
        }

        return tag;
    }

    private void ReportProgress(Action<TagSyncProgress>? onProgress, string phase, int current, int total, string message)
    {
        if (onProgress == null) return;

        var percentComplete = total > 0 ? (int)((current / (double)total) * 100) : 0;
        onProgress(new TagSyncProgress
        {
            Phase = phase,
            Current = current,
            Total = total,
            PercentComplete = percentComplete,
            Message = message
        });
    }

    // Filter support classes and methods
    private class FilterGroup
    {
        public string? Id { get; set; }
        public string Logic { get; set; } = "and";
        public List<object>? Conditions { get; set; }
    }

    private class FilterCondition
    {
        public string? Id { get; set; }
        public string? Field { get; set; }
        public string? Column { get; set; }
        public string? Operator { get; set; }
        public object? Value { get; set; }
        public object? Value2 { get; set; }

        public string? GetFieldName() => Field ?? Column;
        public string? GetValueString() => Value?.ToString();
    }

    private IQueryable<RadiusUser> ApplyAdvancedFilters(IQueryable<RadiusUser> query, FilterGroup? filterGroup)
    {
        if (filterGroup == null || filterGroup.Conditions == null || filterGroup.Conditions.Count == 0)
            return query;

        var conditions = new List<System.Linq.Expressions.Expression<Func<RadiusUser, bool>>>();

        foreach (var item in filterGroup.Conditions)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(item);
            
            if (json.Contains("\"field\"") || json.Contains("\"column\""))
            {
                var condition = System.Text.Json.JsonSerializer.Deserialize<FilterCondition>(json, 
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (condition != null && !string.IsNullOrEmpty(condition.GetFieldName()))
                {
                    var predicate = BuildConditionPredicate(condition);
                    if (predicate != null)
                        conditions.Add(predicate);
                }
            }
        }

        if (conditions.Count == 0)
            return query;

        // Apply conditions based on logic (AND/OR)
        if (filterGroup.Logic?.ToLower() == "or")
        {
            var parameter = System.Linq.Expressions.Expression.Parameter(typeof(RadiusUser), "u");
            System.Linq.Expressions.Expression? combined = null;

            foreach (var cond in conditions)
            {
                var body = System.Linq.Expressions.Expression.Invoke(cond, parameter);
                combined = combined == null ? body : System.Linq.Expressions.Expression.OrElse(combined, body);
            }

            if (combined != null)
            {
                var lambda = System.Linq.Expressions.Expression.Lambda<Func<RadiusUser, bool>>(combined, parameter);
                query = query.Where(lambda);
            }
        }
        else
        {
            foreach (var cond in conditions)
            {
                query = query.Where(cond);
            }
        }

        return query;
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildConditionPredicate(FilterCondition condition)
    {
        var field = condition.GetFieldName()?.ToLower();
        var op = condition.Operator?.ToLower();
        var value = condition.GetValueString();

        return field switch
        {
            "enabled" => op == "equals" && bool.TryParse(value, out var boolVal)
                ? (u => u.Enabled == boolVal)
                : null,
            "balance" => BuildDecimalPredicate(op, value, condition.Value2?.ToString()),
            "expiration" => BuildExpirationPredicate(op, value, condition.Value2?.ToString()),
            "createdat" => BuildCreatedAtPredicate(op, value, condition.Value2?.ToString()),
            "lastonline" => BuildLastOnlinePredicate(op, value, condition.Value2?.ToString()),
            _ => null
        };
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildDecimalPredicate(
        string? op, string? value, string? value2)
    {
        if (!decimal.TryParse(value, out var decVal)) return null;

        return op switch
        {
            "equals" => u => u.Balance == decVal,
            "not_equals" => u => u.Balance != decVal,
            "greater_than" => u => u.Balance > decVal,
            "greater_than_or_equal" => u => u.Balance >= decVal,
            "less_than" => u => u.Balance < decVal,
            "less_than_or_equal" => u => u.Balance <= decVal,
            "between" when decimal.TryParse(value2, out var decVal2) => 
                u => u.Balance >= decVal && u.Balance <= decVal2,
            _ => null
        };
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildExpirationPredicate(
        string? op, string? value, string? value2)
    {
        if (!DateTime.TryParse(value, out var dateVal)) return null;

        return op switch
        {
            "equals" => u => u.Expiration.HasValue && u.Expiration.Value.Date == dateVal.Date,
            "not_equals" => u => !u.Expiration.HasValue || u.Expiration.Value.Date != dateVal.Date,
            "greater_than" or "after" => u => u.Expiration.HasValue && u.Expiration.Value > dateVal,
            "less_than" or "before" => u => u.Expiration.HasValue && u.Expiration.Value < dateVal,
            "between" when DateTime.TryParse(value2, out var dateVal2) =>
                u => u.Expiration.HasValue && u.Expiration.Value >= dateVal && u.Expiration.Value <= dateVal2,
            "is_empty" => u => !u.Expiration.HasValue,
            "is_not_empty" => u => u.Expiration.HasValue,
            _ => null
        };
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildCreatedAtPredicate(
        string? op, string? value, string? value2)
    {
        if (!DateTime.TryParse(value, out var dateVal)) return null;

        return op switch
        {
            "equals" => u => u.CreatedAt.Date == dateVal.Date,
            "not_equals" => u => u.CreatedAt.Date != dateVal.Date,
            "greater_than" or "after" => u => u.CreatedAt > dateVal,
            "less_than" or "before" => u => u.CreatedAt < dateVal,
            "between" when DateTime.TryParse(value2, out var dateVal2) =>
                u => u.CreatedAt >= dateVal && u.CreatedAt <= dateVal2,
            _ => null
        };
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildLastOnlinePredicate(
        string? op, string? value, string? value2)
    {
        if (!DateTime.TryParse(value, out var dateVal)) return null;

        return op switch
        {
            "equals" => u => u.LastOnline.HasValue && u.LastOnline.Value.Date == dateVal.Date,
            "not_equals" => u => !u.LastOnline.HasValue || u.LastOnline.Value.Date != dateVal.Date,
            "greater_than" or "after" => u => u.LastOnline.HasValue && u.LastOnline.Value > dateVal,
            "less_than" or "before" => u => u.LastOnline.HasValue && u.LastOnline.Value < dateVal,
            "between" when DateTime.TryParse(value2, out var dateVal2) =>
                u => u.LastOnline.HasValue && u.LastOnline.Value >= dateVal && u.LastOnline.Value <= dateVal2,
            "is_empty" => u => !u.LastOnline.HasValue,
            "is_not_empty" => u => u.LastOnline.HasValue,
            _ => null
        };
    }
}
