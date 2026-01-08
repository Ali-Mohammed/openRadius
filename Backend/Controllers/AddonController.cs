using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/addons")]
[Authorize]
public class AddonController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AddonController> _logger;

    public AddonController(
        ApplicationDbContext context,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AddonController> logger)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    // GET: api/addons
    [HttpGet]
    public async Task<ActionResult<object>> GetAddons(
        [FromQuery] string? search,
        [FromQuery] int? customWalletId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeDeleted = false)
    {
        try
        {
            var query = _context.Addons
                .Include(a => a.CustomWallet)
                .AsQueryable();

            if (!includeDeleted)
            {
                query = query.Where(a => !a.IsDeleted);
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(a =>
                    a.Name.Contains(search) ||
                    (a.Description != null && a.Description.Contains(search)));
            }

            if (customWalletId.HasValue)
            {
                query = query.Where(a => a.CustomWalletId == customWalletId.Value);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var addons = await query
                .OrderBy(a => a.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.Description,
                    a.Icon,
                    a.Color,
                    a.Price,
                    a.CustomWalletId,
                    CustomWalletName = a.CustomWallet != null ? a.CustomWallet.Name : null,
                    a.IsDeleted,
                    a.CreatedAt,
                    a.UpdatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                data = addons,
                totalCount,
                page,
                pageSize,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting addons");
            return StatusCode(500, new { error = "An error occurred while retrieving addons" });
        }
    }

    // GET: api/addons/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Addon>> GetAddon(int id)
    {
        try
        {
            var addon = await _context.Addons
                .Include(a => a.CustomWallet)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (addon == null)
            {
                return NotFound(new { error = "Addon not found" });
            }

            return Ok(addon);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting addon {id}");
            return StatusCode(500, new { error = "An error occurred while retrieving the addon" });
        }
    }

    // POST: api/addons
    [HttpPost]
    public async Task<ActionResult<Addon>> CreateAddon(Addon addon)
    {
        try
        {
            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            // Validate custom wallet exists
            var wallet = await _context.CustomWallets.FindAsync(addon.CustomWalletId);
            if (wallet == null)
            {
                return BadRequest(new { error = "Custom wallet not found" });
            }

            addon.CreatedAt = DateTime.UtcNow;
            addon.CreatedBy = userEmail;
            addon.IsDeleted = false;

            _context.Addons.Add(addon);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAddon), new { id = addon.Id }, addon);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating addon");
            return StatusCode(500, new { error = "An error occurred while creating the addon" });
        }
    }

    // PUT: api/addons/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAddon(int id, Addon addon)
    {
        try
        {
            if (id != addon.Id)
            {
                return BadRequest(new { error = "ID mismatch" });
            }

            var existingAddon = await _context.Addons.FindAsync(id);
            if (existingAddon == null)
            {
                return NotFound(new { error = "Addon not found" });
            }

            // Validate custom wallet exists
            var wallet = await _context.CustomWallets.FindAsync(addon.CustomWalletId);
            if (wallet == null)
            {
                return BadRequest(new { error = "Custom wallet not found" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            existingAddon.Name = addon.Name;
            existingAddon.Description = addon.Description;
            existingAddon.Icon = addon.Icon;
            existingAddon.Color = addon.Color;
            existingAddon.Price = addon.Price;
            existingAddon.CustomWalletId = addon.CustomWalletId;
            existingAddon.UpdatedAt = DateTime.UtcNow;
            existingAddon.UpdatedBy = userEmail;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error updating addon {id}");
            return StatusCode(500, new { error = "An error occurred while updating the addon" });
        }
    }

    // DELETE: api/addons/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAddon(int id)
    {
        try
        {
            var addon = await _context.Addons.FindAsync(id);
            if (addon == null)
            {
                return NotFound(new { error = "Addon not found" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            addon.IsDeleted = true;
            addon.DeletedAt = DateTime.UtcNow;
            addon.DeletedBy = userEmail;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error deleting addon {id}");
            return StatusCode(500, new { error = "An error occurred while deleting the addon" });
        }
    }

    // POST: api/addons/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreAddon(int id)
    {
        try
        {
            var addon = await _context.Addons
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (addon == null)
            {
                return NotFound(new { error = "Addon not found" });
            }

            if (!addon.IsDeleted)
            {
                return BadRequest(new { error = "Addon is not deleted" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            addon.IsDeleted = false;
            addon.DeletedAt = null;
            addon.DeletedBy = null;
            addon.UpdatedAt = DateTime.UtcNow;
            addon.UpdatedBy = userEmail;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error restoring addon {id}");
            return StatusCode(500, new { error = "An error occurred while restoring the addon" });
        }
    }
}
