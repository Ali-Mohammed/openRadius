using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/ip-pools")]
public class RadiusIpPoolController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<RadiusIpPoolController> _logger;

    public RadiusIpPoolController(ApplicationDbContext context, MasterDbContext masterContext, ILogger<RadiusIpPoolController> logger)
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

    // GET: api/radius/ip-pools
    [HttpGet]
    public async Task<ActionResult<object>> GetIpPools(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var query = _context.RadiusIpPools
            .Where(p => includeDeleted || p.DeletedAt == null);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(p =>
                (p.Name != null && p.Name.ToLower().Contains(searchLower)) ||
                (p.StartIp != null && p.StartIp.ToLower().Contains(searchLower)) ||
                (p.EndIp != null && p.EndIp.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "name" => isDescending ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
                "start_ip" => isDescending ? query.OrderByDescending(p => p.StartIp) : query.OrderBy(p => p.StartIp),
                "end_ip" => isDescending ? query.OrderByDescending(p => p.EndIp) : query.OrderBy(p => p.EndIp),
                "lease_time" => isDescending ? query.OrderByDescending(p => p.LeaseTime) : query.OrderBy(p => p.LeaseTime),
                "created_at" => isDescending ? query.OrderByDescending(p => p.CreatedAt) : query.OrderBy(p => p.CreatedAt),
                _ => query.OrderByDescending(p => p.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(p => p.CreatedAt);
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var ipPools = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = new
        {
            data = ipPools,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalRecords,
                totalPages
            }
        };

        return Ok(response);
    }

    // GET: api/radius/ip-pools/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusIpPool>> GetIpPool(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var ipPool = await _context.RadiusIpPools
            .FirstOrDefaultAsync(p => p.Id == id && p.WorkspaceId == workspaceId.Value && p.DeletedAt == null);

        if (ipPool == null)
        {
            return NotFound(new { message = "IP Pool not found" });
        }

        return Ok(ipPool);
    }

    // POST: api/radius/ip-pools
    [HttpPost]
    public async Task<ActionResult<RadiusIpPool>> CreateIpPool([FromBody] CreateRadiusIpPoolRequest request)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        try
        {
            // Check if IP pool with same name already exists
            var existingPool = await _context.RadiusIpPools
                .FirstOrDefaultAsync(p => p.Name == request.Name && p.DeletedAt == null);

            if (existingPool != null)
            {
                return BadRequest(new { message = "An IP pool with this name already exists" });
            }

            var ipPool = new RadiusIpPool
            {
                Name = request.Name,
                StartIp = request.StartIp,
                EndIp = request.EndIp,
                LeaseTime = request.LeaseTime,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                DeletedAt = null
            };

            _context.RadiusIpPools.Add(ipPool);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetIpPool), new { id = ipPool.Id }, ipPool);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating IP pool");
            return StatusCode(500, new { message = "Failed to create IP pool" });
        }
    }

    // PUT: api/radius/ip-pools/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIpPool(int id, [FromBody] UpdateRadiusIpPoolRequest request)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        try
        {
            var ipPool = await _context.RadiusIpPools
                .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null);

            if (ipPool == null)
            {
                return NotFound(new { message = "IP Pool not found" });
            }

            // Check if updating name would create a duplicate
            if (request.Name != null && request.Name != ipPool.Name)
            {
                var existingPool = await _context.RadiusIpPools
                    .FirstOrDefaultAsync(p => p.Name == request.Name && p.Id != id && p.DeletedAt == null);

                if (existingPool != null)
                {
                    return BadRequest(new { message = "An IP pool with this name already exists" });
                }
            }

            // Update fields if provided
            if (request.Name != null) ipPool.Name = request.Name;
            if (request.StartIp != null) ipPool.StartIp = request.StartIp;
            if (request.EndIp != null) ipPool.EndIp = request.EndIp;
            if (request.LeaseTime.HasValue) ipPool.LeaseTime = request.LeaseTime.Value;

            ipPool.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(ipPool);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating IP pool {Id}", id);
            return StatusCode(500, new { message = "Failed to update IP pool" });
        }
    }

    // DELETE: api/radius/ip-pools/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIpPool(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var ipPool = await _context.RadiusIpPools
            .FirstOrDefaultAsync(p => p.Id == id && p.WorkspaceId == workspaceId.Value && p.DeletedAt == null);

        if (ipPool == null)
        {
            return NotFound(new { message = "IP Pool not found" });
        }

        ipPool.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/ip-pools/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreIpPool(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var ipPool = await _context.RadiusIpPools
            .FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt != null);

        if (ipPool == null)
        {
            return NotFound(new { message = "Deleted IP pool not found" });
        }

        ipPool.DeletedAt = null;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // GET: api/radius/ip-pools/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedIpPools(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var query = _context.RadiusIpPools
            .Where(p => p.DeletedAt != null);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var ipPools = await query
            .OrderByDescending(p => p.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = new
        {
            data = ipPools,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalRecords,
                totalPages
            }
        };

        return Ok(response);
    }
}
