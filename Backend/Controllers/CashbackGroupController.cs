using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/billing/cashback-groups")]
public class CashbackGroupController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CashbackGroupController(ApplicationDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    // GET: api/billing/cashback-groups
    [HttpGet]
    public async Task<ActionResult<object>> GetGroups(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool onlyDeleted = false)
    {
        var query = _context.CashbackGroups
            .Include(g => g.CashbackGroupUsers)
            .AsQueryable();

        // Apply soft delete filter
        if (onlyDeleted)
        {
            query = query.IgnoreQueryFilters().Where(g => g.DeletedAt != null);
        }

        // Apply search
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(g => g.Name.ToLower().Contains(searchLower));
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "name" => isDescending ? query.OrderByDescending(g => g.Name) : query.OrderBy(g => g.Name),
                "disabled" => isDescending ? query.OrderByDescending(g => g.Disabled) : query.OrderBy(g => g.Disabled),
                "usercount" => isDescending ? query.OrderByDescending(g => g.CashbackGroupUsers.Count) : query.OrderBy(g => g.CashbackGroupUsers.Count),
                "createdat" => isDescending ? query.OrderByDescending(g => g.CreatedAt) : query.OrderBy(g => g.CreatedAt),
                _ => query.OrderByDescending(g => g.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(g => g.CreatedAt);
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var groups = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(g => new CashbackGroupResponse
            {
                Id = g.Id,
                Name = g.Name,
                Icon = g.Icon,
                Color = g.Color,
                Disabled = g.Disabled,
                UserCount = g.CashbackGroupUsers.Count,
                CreatedAt = g.CreatedAt,
                UpdatedAt = g.UpdatedAt,
                DeletedAt = g.DeletedAt,
                DeletedBy = g.DeletedBy
            })
            .ToListAsync();

        return Ok(new
        {
            data = groups,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages,
                hasNextPage = page < totalPages,
                hasPreviousPage = page > 1
            }
        });
    }

    // GET: api/billing/cashback-groups/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<CashbackGroupResponse>> GetGroup(int id)
    {
        var group = await _context.CashbackGroups
            .Include(g => g.CashbackGroupUsers)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound(new { message = "Cashback group not found" });
        }

        return Ok(new CashbackGroupResponse
        {
            Id = group.Id,
            Name = group.Name,
            Icon = group.Icon,
            Color = group.Color,
            Disabled = group.Disabled,
            UserCount = group.CashbackGroupUsers.Count,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt,
            DeletedAt = group.DeletedAt,
            DeletedBy = group.DeletedBy
        });
    }

    // GET: api/billing/cashback-groups/{id}/users
    [HttpGet("{id}/users")]
    public async Task<ActionResult<List<int>>> GetGroupUsers(int id)
    {
        var userIds = await _context.CashbackGroupUsers
            .Where(gu => gu.CashbackGroupId == id)
            .Select(gu => gu.UserId)
            .ToListAsync();

        return Ok(userIds);
    }

    // POST: api/billing/cashback-groups
    [HttpPost]
    public async Task<ActionResult<CashbackGroupResponse>> CreateGroup(CreateCashbackGroupRequest request)
    {
        var group = new CashbackGroup
        {
            Name = request.Name,
            Icon = request.Icon,
            Color = request.Color,
            Disabled = request.Disabled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.CashbackGroups.Add(group);
        await _context.SaveChangesAsync();

        // Add users to group
        if (request.UserIds.Any())
        {
            var groupUsers = request.UserIds.Select(userId => new CashbackGroupUser
            {
                CashbackGroupId = group.Id,
                UserId = userId,
                AssignedAt = DateTime.UtcNow
            });

            _context.CashbackGroupUsers.AddRange(groupUsers);
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, new CashbackGroupResponse
        {
            Id = group.Id,
            Name = group.Name,
            Icon = group.Icon,
            Color = group.Color,
            Disabled = group.Disabled,
            UserCount = request.UserIds.Count,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt
        });
    }

    // PUT: api/billing/cashback-groups/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateGroup(int id, UpdateCashbackGroupRequest request)
    {
        var group = await _context.CashbackGroups
            .Include(g => g.CashbackGroupUsers)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound(new { message = "Cashback group not found" });
        }

        // Update basic fields
        if (request.Name != null) group.Name = request.Name;
        if (request.Icon != null) group.Icon = request.Icon;
        if (request.Color != null) group.Color = request.Color;
        if (request.Disabled.HasValue) group.Disabled = request.Disabled.Value;

        group.UpdatedAt = DateTime.UtcNow;

        // Update users if provided
        if (request.UserIds != null)
        {
            // Remove existing users
            _context.CashbackGroupUsers.RemoveRange(group.CashbackGroupUsers);

            // Add new users
            var groupUsers = request.UserIds.Select(userId => new CashbackGroupUser
            {
                CashbackGroupId = group.Id,
                UserId = userId,
                AssignedAt = DateTime.UtcNow
            });

            _context.CashbackGroupUsers.AddRange(groupUsers);
        }

        await _context.SaveChangesAsync();

        return Ok(new CashbackGroupResponse
        {
            Id = group.Id,
            Name = group.Name,
            Icon = group.Icon,
            Color = group.Color,
            Disabled = group.Disabled,
            UserCount = group.CashbackGroupUsers.Count,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt
        });
    }

    // DELETE: api/billing/cashback-groups/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        var group = await _context.CashbackGroups.FindAsync(id);

        if (group == null)
        {
            return NotFound(new { message = "Cashback group not found" });
        }

        var userEmail = _httpContextAccessor.HttpContext?.User?.Claims
            .FirstOrDefault(c => c.Type == "email")?.Value ?? "System";

        group.DeletedAt = DateTime.UtcNow;
        group.DeletedBy = userEmail;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Cashback group moved to trash successfully" });
    }

    // POST: api/billing/cashback-groups/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreGroup(int id)
    {
        var group = await _context.CashbackGroups
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound(new { message = "Cashback group not found" });
        }

        group.DeletedAt = null;
        group.DeletedBy = null;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Cashback group restored successfully" });
    }
}
