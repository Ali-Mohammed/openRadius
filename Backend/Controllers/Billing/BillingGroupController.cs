using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BillingGroupController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<BillingGroupController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public BillingGroupController(
        ApplicationDbContext context,
        ILogger<BillingGroupController> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // GET: api/group
    [HttpGet]
    public async Task<ActionResult<object>> GetGroups(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeDeleted = false)
    {
        try
        {
            var query = _context.BillingGroups
                .Include(g => g.GroupUsers)
                .AsQueryable();

            if (!includeDeleted)
            {
                query = query.Where(g => !g.IsDeleted);
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(g => 
                    g.Name.ToLower().Contains(search.ToLower()) || 
                    (g.Description != null && g.Description.ToLower().Contains(search.ToLower())));
            }

            if (isActive.HasValue)
            {
                query = query.Where(g => g.IsActive == isActive.Value);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var groups = await query
                .OrderByDescending(g => g.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(g => new
                {
                    g.Id,
                    g.Name,
                    g.Description,
                    g.Icon,
                    g.Color,
                    g.IsActive,
                    g.IsDeleted,
                    g.CreatedAt,
                    g.UpdatedAt,
                    UserCount = g.GroupUsers.Count,
                    UserIds = g.GroupUsers.Select(gu => gu.UserId).ToList()
                })
                .ToListAsync();

            return Ok(new
            {
                data = groups,
                totalCount,
                page,
                pageSize,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting groups");
            return StatusCode(500, new { error = "An error occurred while retrieving groups" });
        }
    }

    // GET: api/group/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetGroup(int id)
    {
        try
        {
            var group = await _context.BillingGroups
                .Include(g => g.GroupUsers)
                .Where(g => g.Id == id)
                .Select(g => new
                {
                    g.Id,
                    g.Name,
                    g.Description,
                    g.Icon,
                    g.Color,
                    g.IsActive,
                    g.IsDeleted,
                    g.CreatedAt,
                    g.UpdatedAt,
                    UserIds = g.GroupUsers.Select(gu => gu.UserId).ToList()
                })
                .FirstOrDefaultAsync();

            if (group == null)
            {
                return NotFound(new { error = "Group not found" });
            }

            return Ok(group);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting group {id}");
            return StatusCode(500, new { error = "An error occurred while retrieving the group" });
        }
    }

    // POST: api/group
    [HttpPost]
    public async Task<ActionResult<BillingGroup>> CreateGroup([FromBody] CreateBillingGroupRequest request)
    {
        try
        {
            // Check if group with same name already exists
            var existingGroup = await _context.BillingGroups
                .FirstOrDefaultAsync(g => g.Name.ToLower() == request.Name.ToLower() && !g.IsDeleted);
            
            if (existingGroup != null)
            {
                return BadRequest(new { error = "A group with this name already exists" });
            }

            var group = new BillingGroup
            {
                Name = request.Name,
                Description = request.Description,
                Icon = request.Icon,
                Color = request.Color,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId(),
                IsDeleted = false
            };

            _context.BillingGroups.Add(group);
            await _context.SaveChangesAsync();

            // Add users to group
            if (request.UserIds != null && request.UserIds.Any())
            {
                foreach (var userId in request.UserIds)
                {
                    var groupUser = new BillingGroupUser
                    {
                        GroupId = group.Id,
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId()
                    };
                    _context.Set<BillingGroupUser>().Add(groupUser);
                }
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, group);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating group");
            return StatusCode(500, new { error = "An error occurred while creating the group" });
        }
    }

    // PUT: api/group/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateGroup(int id, [FromBody] UpdateBillingGroupRequest request)
    {
        try
        {
            var existingGroup = await _context.BillingGroups
                .Include(g => g.GroupUsers)
                .FirstOrDefaultAsync(g => g.Id == id);

            if (existingGroup == null)
            {
                return NotFound(new { error = "Group not found" });
            }

            // Check if another group with same name exists
            var duplicateName = await _context.BillingGroups
                .FirstOrDefaultAsync(g => g.Name.ToLower() == request.Name.ToLower() 
                    && g.Id != id 
                    && !g.IsDeleted);
            
            if (duplicateName != null)
            {
                return BadRequest(new { error = "A group with this name already exists" });
            }

            existingGroup.Name = request.Name;
            existingGroup.Description = request.Description;
            existingGroup.Icon = request.Icon;
            existingGroup.Color = request.Color;
            existingGroup.IsActive = request.IsActive;
            existingGroup.UpdatedAt = DateTime.UtcNow;
            existingGroup.UpdatedBy = User.GetSystemUserId();

            // Update users - remove old ones and add new ones
            var existingGroupUsers = existingGroup.GroupUsers.ToList();
            _context.Set<BillingGroupUser>().RemoveRange(existingGroupUsers);

            if (request.UserIds != null && request.UserIds.Any())
            {
                foreach (var userId in request.UserIds)
                {
                    var groupUser = new BillingGroupUser
                    {
                        GroupId = existingGroup.Id,
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId()
                    };
                    _context.Set<BillingGroupUser>().Add(groupUser);
                }
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error updating group {id}");
            return StatusCode(500, new { error = "An error occurred while updating the group" });
        }
    }

    // DELETE: api/group/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        try
        {
            var group = await _context.BillingGroups.FindAsync(id);
            if (group == null)
            {
                return NotFound(new { error = "Group not found" });
            }

            group.IsDeleted = true;
            group.DeletedAt = DateTime.UtcNow;
            group.DeletedBy = User.GetSystemUserId();

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error deleting group {id}");
            return StatusCode(500, new { error = "An error occurred while deleting the group" });
        }
    }

    // POST: api/group/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreGroup(int id)
    {
        try
        {
            var group = await _context.BillingGroups
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(g => g.Id == id);

            if (group == null)
            {
                return NotFound(new { error = "Group not found" });
            }

            group.IsDeleted = false;
            group.DeletedAt = null;
            group.DeletedBy = null;
            group.UpdatedAt = DateTime.UtcNow;
            group.UpdatedBy = User.GetSystemUserId();

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error restoring group {id}");
            return StatusCode(500, new { error = "An error occurred while restoring the group" });
        }
    }
}

public class CreateBillingGroupRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
    public List<int>? UserIds { get; set; }
}

public class UpdateBillingGroupRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }
    public List<int>? UserIds { get; set; }
}
