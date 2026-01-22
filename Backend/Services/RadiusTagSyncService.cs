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

    public async Task<TagSyncResult> SyncTagsAsync(Action<TagSyncProgress>? onProgress = null)
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

            // Get all active radius users
            var users = await context.RadiusUsers
                .Include(u => u.RadiusUserTags)
                .Where(u => !u.IsDeleted)
                .ToListAsync();

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
}
