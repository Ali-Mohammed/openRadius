using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/groups")]
[Authorize]
public class RadiusGroupController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<RadiusGroupController> _logger;

    public RadiusGroupController(ApplicationDbContext context, MasterDbContext masterContext, ILogger<RadiusGroupController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _logger = logger;
    }

    private async Task<int?> GetCurrentWorkspaceIdAsync()
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(userEmail)) return null;
        
        var user = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
        return user?.CurrentWorkspaceId;
    }

    // GET: api/radius/groups
    [HttpGet]
    public async Task<ActionResult<object>> GetGroups(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        _logger.LogInformation("GetGroups called: page={Page}, pageSize={PageSize}, search={Search}", page, pageSize, search);
        
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            _logger.LogWarning("User workspace not found for GetGroups");
            return Unauthorized(new { message = "User workspace not found" });
        }

        _logger.LogInformation("Querying groups for workspace");
        
        var query = _context.RadiusGroups
            .Where(g => includeDeleted || !g.IsDeleted);
        
        var totalInWorkspace = await _context.RadiusGroups.CountAsync();
        _logger.LogInformation("Total groups in workspace: {Total}", totalInWorkspace);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(g => 
                (g.Name != null && g.Name.ToLower().Contains(searchLower)) ||
                (g.Subscription != null && g.Subscription.ToLower().Contains(searchLower))
            );
        }

        // For userCount sorting, use GroupJoin
        if (!string.IsNullOrWhiteSpace(sortField) && sortField.ToLower() == "usercount")
        {
            var groupsWithCounts = await query
                .GroupJoin(
                    _context.RadiusUsers.Where(u => !u.IsDeleted),
                    group => group.Id,
                    user => user.GroupId,
                    (group, users) => new { Group = group, UserCount = users.Count() }
                )
                .ToListAsync();

            var isDescending = sortDirection?.ToLower() == "desc";
            var sortedGroups = isDescending 
                ? groupsWithCounts.OrderByDescending(x => x.UserCount) 
                : groupsWithCounts.OrderBy(x => x.UserCount);

            var totalRecords = sortedGroups.Count();
            var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

            var pagedGroups = sortedGroups
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var response = new List<RadiusGroupResponse>();
            foreach (var item in pagedGroups)
            {
                response.Add(new RadiusGroupResponse
                {
                    Id = item.Group.Id,
                    ExternalId = item.Group.ExternalId,
                    Name = item.Group.Name,
                    Description = item.Group.Description,
                    Subscription = item.Group.Subscription,
                    IsActive = item.Group.IsActive,
                    Color = item.Group.Color,
                    Icon = item.Group.Icon,
                    UsersCount = item.UserCount,
                    CreatedAt = item.Group.CreatedAt,
                    UpdatedAt = item.Group.UpdatedAt,
                    LastSyncedAt = item.Group.LastSyncedAt
                });
            }

            return Ok(new
            {
                data = response,
                pagination = new
                {
                    currentPage = page,
                    pageSize = pageSize,
                    totalRecords = totalRecords,
                    totalPages = totalPages
                }
            });
        }

        // Apply sorting for other fields
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "name" => isDescending ? query.OrderByDescending(g => g.Name) : query.OrderBy(g => g.Name),
                "subscription" => isDescending ? query.OrderByDescending(g => g.Subscription) : query.OrderBy(g => g.Subscription),
                "isactive" => isDescending ? query.OrderByDescending(g => g.IsActive) : query.OrderBy(g => g.IsActive),
                "createdat" => isDescending ? query.OrderByDescending(g => g.CreatedAt) : query.OrderBy(g => g.CreatedAt),
                _ => query.OrderByDescending(g => g.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(g => g.CreatedAt);
        }

        var totalCount = await query.CountAsync();
        var totalPagesCount = (int)Math.Ceiling(totalCount / (double)pageSize);

        var groups = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var responseData = new List<RadiusGroupResponse>();
        foreach (var group in groups)
        {
            var userCount = await _context.RadiusUsers
                .CountAsync(u => u.GroupId == group.Id && !u.IsDeleted);

            responseData.Add(new RadiusGroupResponse
            {
                Id = group.Id,
                ExternalId = group.ExternalId,
                Name = group.Name,
                Description = group.Description,
                Subscription = group.Subscription,
                IsActive = group.IsActive,
                Color = group.Color,
                Icon = group.Icon,
                UsersCount = userCount,
                CreatedAt = group.CreatedAt,
                UpdatedAt = group.UpdatedAt,
                LastSyncedAt = group.LastSyncedAt
            });
        }

        return Ok(new
        {
            data = responseData,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalCount,
                totalPages = totalPagesCount
            }
        });
    }

    // GET: api/radius/groups/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusGroupResponse>> GetGroup(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var group = await _context.RadiusGroups
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null)
        {
            return NotFound(new { message = "Group not found" });
        }

        var userCount = await _context.RadiusUsers
            .CountAsync(u => u.GroupId == group.Id && !u.IsDeleted);

        var response = new RadiusGroupResponse
        {
            Id = group.Id,
            ExternalId = group.ExternalId,
            Name = group.Name,
            Description = group.Description,
            Subscription = group.Subscription,
            IsActive = group.IsActive,
            Color = group.Color,
            Icon = group.Icon,
            UsersCount = userCount,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt,
            LastSyncedAt = group.LastSyncedAt
        };

        return Ok(response);
    }

    // POST: api/radius/groups
    [HttpPost]
    public async Task<ActionResult<RadiusGroupResponse>> CreateGroup([FromBody] CreateGroupRequest request)
    {
        try
        {
            _logger.LogInformation("Creating group: {Name}, Subscription: {Subscription}", request.Name, request.Subscription);
            
            var workspaceId = await GetCurrentWorkspaceIdAsync();
            if (workspaceId == null)
            {
                _logger.LogWarning("User workspace not found for group creation");
                return Unauthorized(new { message = "User workspace not found" });
            }

            _logger.LogInformation("Creating group for workspace: {WorkspaceId}", workspaceId.Value);

            var group = new RadiusGroup
            {
                Name = request.Name,
                Subscription = request.Subscription,
                IsActive = request.IsActive,
                Color = request.Color ?? "#3b82f6",
                Icon = request.Icon ?? "Users",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.RadiusGroups.Add(group);
            var saved = await _context.SaveChangesAsync();
            _logger.LogInformation("Group saved to database. Affected rows: {Saved}, Group ID: {Id}", saved, group.Id);

            var response = new RadiusGroupResponse
            {
                Id = group.Id,
                ExternalId = group.ExternalId,
                Name = group.Name,
                Description = group.Description,
                Subscription = group.Subscription,
                IsActive = group.IsActive,
                Color = group.Color,
                Icon = group.Icon,
                UsersCount = 0,
                CreatedAt = group.CreatedAt,
                UpdatedAt = group.UpdatedAt,
                LastSyncedAt = group.LastSyncedAt
            };

            return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating group: {Message}", ex.Message);
            return StatusCode(500, new { message = "Failed to create group", error = ex.Message });
        }
    }

    // PUT: api/radius/groups/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<RadiusGroupResponse>> UpdateGroup(int id, [FromBody] UpdateGroupRequest request)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var group = await _context.RadiusGroups
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null)
        {
            return NotFound(new { message = "Group not found" });
        }

        // Update only provided fields
        if (request.Name != null) group.Name = request.Name;
        if (request.Subscription != null) group.Subscription = request.Subscription;
        if (request.IsActive.HasValue) group.IsActive = request.IsActive.Value;
        if (request.Color != null) group.Color = request.Color;
        if (request.Icon != null) group.Icon = request.Icon;

        group.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var userCount = await _context.RadiusUsers
            .CountAsync(u => u.GroupId == group.Id && !u.IsDeleted);

        var response = new RadiusGroupResponse
        {
            Id = group.Id,
            ExternalId = group.ExternalId,
            Name = group.Name,
            Description = group.Description,
            Subscription = group.Subscription,
            IsActive = group.IsActive,
            Color = group.Color,
            Icon = group.Icon,
            UsersCount = userCount,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt,
            LastSyncedAt = group.LastSyncedAt
        };

        return Ok(response);
    }

    // DELETE: api/radius/groups/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var group = await _context.RadiusGroups
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null)
        {
            return NotFound(new { message = "Group not found" });
        }

        group.IsDeleted = true;
        group.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/groups/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreGroup(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var group = await _context.RadiusGroups
            .FirstOrDefaultAsync(g => g.Id == id && g.IsDeleted);

        if (group == null)
        {
            return NotFound(new { message = "Deleted group not found" });
        }

        group.IsDeleted = false;
        group.DeletedAt = null;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // GET: api/radius/groups/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedGroups(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var query = _context.RadiusGroups
            .Where(g => g.IsDeleted);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var groups = await query
            .OrderByDescending(g => g.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = groups.Select(g => new RadiusGroupResponse
        {
            Id = g.Id,
            ExternalId = g.ExternalId,
            Name = g.Name,
            Description = g.Description,
            Subscription = g.Subscription,
            IsActive = g.IsActive,
            UsersCount = 0,
            CreatedAt = g.CreatedAt,
            UpdatedAt = g.UpdatedAt,
            LastSyncedAt = g.LastSyncedAt
        });

        return Ok(new
        {
            data = response,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }
}
