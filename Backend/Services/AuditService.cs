using Backend.Data;
using Backend.DTOs;
using Backend.Helpers;
using Backend.Models;
using Backend.Models.Management;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Backend.Services;

/// <summary>
/// Implementation of the audit service. Records and queries audit log entries
/// with full user resolution and pagination support.
/// </summary>
public class AuditService : IAuditService
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<AuditService> _logger;

    public AuditService(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        ILogger<AuditService> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _logger = logger;
    }

    // ── Write ────────────────────────────────────────────────────────────────

    public async Task<AuditLog> LogAsync(CreateAuditLogDto dto, ClaimsPrincipal? user = null, HttpContext? httpContext = null)
    {
        var userId = user?.GetSystemUserId() ?? 0;
        var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();
        var userAgent = httpContext?.Request?.Headers["User-Agent"].FirstOrDefault();

        return await LogAsync(dto, userId, ipAddress, userAgent);
    }

    public async Task<AuditLog> LogAsync(CreateAuditLogDto dto, int performedByUserId, string? ipAddress = null, string? userAgent = null)
    {
        // Resolve target user ID from UUID if provided
        int? targetUserId = null;
        if (dto.TargetUserUuid.HasValue)
        {
            targetUserId = await _masterContext.Users
                .Where(u => u.Uuid == dto.TargetUserUuid.Value)
                .Select(u => (int?)u.Id)
                .FirstOrDefaultAsync();
        }

        // Resolve entity internal ID from UUID if provided
        int? entityId = null;
        if (dto.EntityUuid.HasValue)
        {
            // Best-effort: we store the UUID, entity ID is optional
            entityId = null;
        }

        var entry = new AuditLog
        {
            Action = dto.Action,
            EntityType = dto.EntityType,
            EntityId = entityId,
            EntityUuid = dto.EntityUuid,
            Category = dto.Category,
            PreviousData = dto.PreviousData,
            NewData = dto.NewData,
            Changes = dto.Changes,
            Description = dto.Description,
            Reason = dto.Reason,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = dto.Metadata,
            Status = dto.Status ?? "Success",
            ErrorMessage = dto.ErrorMessage,
            TargetUserId = targetUserId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = performedByUserId,
        };

        _context.AuditLogs.Add(entry);
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Audit: [{Category}] {Action} on {EntityType} ({EntityUuid}) by User {UserId} — {Status}",
            entry.Category, entry.Action, entry.EntityType, entry.EntityUuid, performedByUserId, entry.Status);

        return entry;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    public async Task<AuditLogPagedResponse> GetLogsAsync(AuditLogFilterDto filter)
    {
        var query = _context.AuditLogs.AsNoTracking().AsQueryable();

        // ── Filters ──
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.ToLower();
            query = query.Where(a =>
                a.Description != null && a.Description.ToLower().Contains(search) ||
                a.Action.ToLower().Contains(search) ||
                a.EntityType.ToLower().Contains(search) ||
                a.Category.ToLower().Contains(search) ||
                a.Reason != null && a.Reason.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
            query = query.Where(a => a.Action == filter.Action);

        if (!string.IsNullOrWhiteSpace(filter.EntityType))
            query = query.Where(a => a.EntityType == filter.EntityType);

        if (filter.EntityUuid.HasValue)
            query = query.Where(a => a.EntityUuid == filter.EntityUuid.Value);

        if (!string.IsNullOrWhiteSpace(filter.Category))
            query = query.Where(a => a.Category == filter.Category);

        if (!string.IsNullOrWhiteSpace(filter.Status))
            query = query.Where(a => a.Status == filter.Status);

        if (filter.StartDate.HasValue)
            query = query.Where(a => a.CreatedAt >= filter.StartDate.Value);

        if (filter.EndDate.HasValue)
            query = query.Where(a => a.CreatedAt <= filter.EndDate.Value);

        // User UUID filter → resolve to internal ID
        if (filter.PerformedByUuid.HasValue)
        {
            var userId = await _masterContext.Users
                .Where(u => u.Uuid == filter.PerformedByUuid.Value)
                .Select(u => (int?)u.Id)
                .FirstOrDefaultAsync();
            if (userId.HasValue)
                query = query.Where(a => a.CreatedBy == userId.Value);
            else
                query = query.Where(a => false); // UUID not found — return empty
        }

        if (filter.TargetUserUuid.HasValue)
        {
            var targetId = await _masterContext.Users
                .Where(u => u.Uuid == filter.TargetUserUuid.Value)
                .Select(u => (int?)u.Id)
                .FirstOrDefaultAsync();
            if (targetId.HasValue)
                query = query.Where(a => a.TargetUserId == targetId.Value);
            else
                query = query.Where(a => false);
        }

        // ── Count ──
        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize);

        // ── Sorting ──
        query = (filter.SortField?.ToLower(), filter.SortDirection?.ToLower()) switch
        {
            ("action", "asc") => query.OrderBy(a => a.Action),
            ("action", _) => query.OrderByDescending(a => a.Action),
            ("entitytype", "asc") => query.OrderBy(a => a.EntityType),
            ("entitytype", _) => query.OrderByDescending(a => a.EntityType),
            ("category", "asc") => query.OrderBy(a => a.Category),
            ("category", _) => query.OrderByDescending(a => a.Category),
            ("status", "asc") => query.OrderBy(a => a.Status),
            ("status", _) => query.OrderByDescending(a => a.Status),
            ("createdat", "asc") => query.OrderBy(a => a.CreatedAt),
            _ => query.OrderByDescending(a => a.CreatedAt),
        };

        // ── Pagination ──
        var entries = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        // ── Resolve user details from MasterDbContext ──
        var userIds = entries
            .SelectMany(e => new[] { e.CreatedBy, e.TargetUserId ?? 0 })
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        var users = await _masterContext.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Uuid, u.Email, u.FirstName, u.LastName })
            .ToDictionaryAsync(u => u.Id);

        // ── Map to DTOs ──
        var data = entries.Select(e =>
        {
            var performedBy = users.GetValueOrDefault(e.CreatedBy);
            var targetUser = e.TargetUserId.HasValue ? users.GetValueOrDefault(e.TargetUserId.Value) : null;

            return new AuditLogDto
            {
                Uuid = e.Uuid,
                Action = e.Action,
                EntityType = e.EntityType,
                EntityUuid = e.EntityUuid,
                Category = e.Category,
                PreviousData = e.PreviousData,
                NewData = e.NewData,
                Changes = e.Changes,
                Description = e.Description,
                Reason = e.Reason,
                IpAddress = e.IpAddress,
                UserAgent = e.UserAgent,
                RequestPath = e.RequestPath,
                CorrelationId = e.CorrelationId,
                Metadata = e.Metadata,
                Status = e.Status,
                ErrorMessage = e.ErrorMessage,
                CreatedAt = e.CreatedAt,
                PerformedBy = performedBy != null ? new AuditUserDto
                {
                    Uuid = performedBy.Uuid,
                    Email = performedBy.Email,
                    FullName = $"{performedBy.FirstName} {performedBy.LastName}".Trim(),
                } : null,
                TargetUser = targetUser != null ? new AuditUserDto
                {
                    Uuid = targetUser.Uuid,
                    Email = targetUser.Email,
                    FullName = $"{targetUser.FirstName} {targetUser.LastName}".Trim(),
                } : null,
            };
        }).ToList();

        return new AuditLogPagedResponse
        {
            Data = data,
            CurrentPage = filter.Page,
            PageSize = filter.PageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
        };
    }

    public async Task<AuditLogDto?> GetByUuidAsync(Guid uuid)
    {
        var entry = await _context.AuditLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Uuid == uuid);

        if (entry == null) return null;

        // Resolve users
        var userIds = new List<int> { entry.CreatedBy };
        if (entry.TargetUserId.HasValue) userIds.Add(entry.TargetUserId.Value);

        var users = await _masterContext.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Uuid, u.Email, u.FirstName, u.LastName })
            .ToDictionaryAsync(u => u.Id);

        var performedBy = users.GetValueOrDefault(entry.CreatedBy);
        var targetUser = entry.TargetUserId.HasValue ? users.GetValueOrDefault(entry.TargetUserId.Value) : null;

        return new AuditLogDto
        {
            Uuid = entry.Uuid,
            Action = entry.Action,
            EntityType = entry.EntityType,
            EntityUuid = entry.EntityUuid,
            Category = entry.Category,
            PreviousData = entry.PreviousData,
            NewData = entry.NewData,
            Changes = entry.Changes,
            Description = entry.Description,
            Reason = entry.Reason,
            IpAddress = entry.IpAddress,
            UserAgent = entry.UserAgent,
            RequestPath = entry.RequestPath,
            CorrelationId = entry.CorrelationId,
            Metadata = entry.Metadata,
            Status = entry.Status,
            ErrorMessage = entry.ErrorMessage,
            CreatedAt = entry.CreatedAt,
            PerformedBy = performedBy != null ? new AuditUserDto
            {
                Uuid = performedBy.Uuid,
                Email = performedBy.Email,
                FullName = $"{performedBy.FirstName} {performedBy.LastName}".Trim(),
            } : null,
            TargetUser = targetUser != null ? new AuditUserDto
            {
                Uuid = targetUser.Uuid,
                Email = targetUser.Email,
                FullName = $"{targetUser.FirstName} {targetUser.LastName}".Trim(),
            } : null,
        };
    }

    public async Task<AuditLogStatsDto> GetStatsAsync(AuditLogFilterDto? filter = null)
    {
        var query = _context.AuditLogs.AsNoTracking().AsQueryable();

        if (filter != null)
        {
            if (!string.IsNullOrWhiteSpace(filter.Category))
                query = query.Where(a => a.Category == filter.Category);
            if (filter.StartDate.HasValue)
                query = query.Where(a => a.CreatedAt >= filter.StartDate.Value);
            if (filter.EndDate.HasValue)
                query = query.Where(a => a.CreatedAt <= filter.EndDate.Value);
        }

        var today = DateTime.UtcNow.Date;

        var totalEntries = await query.CountAsync();
        var todayEntries = await query.CountAsync(a => a.CreatedAt >= today);
        var failedEntries = await query.CountAsync(a => a.Status == "Failure");

        var byCategory = await query
            .GroupBy(a => a.Category)
            .Select(g => new AuditCategoryCountDto { Category = g.Key, Count = g.Count() })
            .OrderByDescending(c => c.Count)
            .ToListAsync();

        var byAction = await query
            .GroupBy(a => a.Action)
            .Select(g => new AuditActionCountDto { Action = g.Key, Count = g.Count() })
            .OrderByDescending(c => c.Count)
            .Take(20)
            .ToListAsync();

        return new AuditLogStatsDto
        {
            TotalEntries = totalEntries,
            TodayEntries = todayEntries,
            FailedEntries = failedEntries,
            ByCategory = byCategory,
            ByAction = byAction,
        };
    }

    public async Task<List<string>> GetCategoriesAsync()
    {
        return await _context.AuditLogs
            .AsNoTracking()
            .Select(a => a.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
    }

    public async Task<List<string>> GetActionsAsync()
    {
        return await _context.AuditLogs
            .AsNoTracking()
            .Select(a => a.Action)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
    }

    public async Task<List<string>> GetEntityTypesAsync()
    {
        return await _context.AuditLogs
            .AsNoTracking()
            .Select(a => a.EntityType)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
    }
}
