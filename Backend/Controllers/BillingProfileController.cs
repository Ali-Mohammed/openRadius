using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class BillingProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<BillingProfileController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public BillingProfileController(
        ApplicationDbContext context,
        ILogger<BillingProfileController> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // POST: api/billingprofile/{id}/toggle-active
    [HttpPost("{id}/toggle-active")]
    public async Task<ActionResult<BillingProfile>> ToggleActive(int id)
    {
        try
        {
            var profile = await _context.BillingProfiles.FindAsync(id);
            if (profile == null || profile.IsDeleted)
            {
                return NotFound($"Billing profile with ID {id} not found.");
            }

            profile.IsActive = !profile.IsActive;
            profile.UpdatedAt = DateTime.UtcNow;
            profile.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "System";

            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Billing profile {id} active status toggled to {profile.IsActive}");
            
            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error toggling active status for billing profile {id}");
            return StatusCode(500, "An error occurred while toggling the profile status.");
        }
    }

    // GET: api/billingprofile
    [HttpGet]
    public async Task<ActionResult<object>> GetProfiles(
        [FromQuery] string? search = null,
        [FromQuery] int? radiusProfileId = null,
        [FromQuery] int? billingGroupId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] bool? isActive = null)
    {
        try
        {
            var query = _context.BillingProfiles
                .Include(p => p.ProfileWallets.OrderBy(w => w.DisplayOrder))
                .Include(p => p.ProfileAddons.OrderBy(a => a.DisplayOrder))
                .AsQueryable();

            if (!includeDeleted)
            {
                query = query.Where(p => !p.IsDeleted);
            }

            if (isActive.HasValue)
            {
                query = query.Where(p => p.IsActive == isActive.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(p =>
                    p.Name.ToLower().Contains(search.ToLower()) ||
                    (p.Description != null && p.Description.ToLower().Contains(search.ToLower())));
            }

            if (radiusProfileId.HasValue)
            {
                query = query.Where(p => p.RadiusProfileId == radiusProfileId.Value);
            }

            if (billingGroupId.HasValue)
            {
                query = query.Where(p => p.BillingGroupId == billingGroupId.Value);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var profiles = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.Price,
                    p.RadiusProfileId,
                    p.BillingGroupId,
                    p.IsActive,
                    p.IsDeleted,
                    p.DeletedAt,
                    p.CreatedAt,
                    p.UpdatedAt,
                    Wallets = p.ProfileWallets.Select(w => new
                    {
                        w.Id,
                        w.WalletType,
                        w.UserWalletId,
                        w.CustomWalletId,
                        price = w.Percentage,
                        w.Direction,
                        w.DisplayOrder
                    }).ToList(),
                    Addons = p.ProfileAddons.Select(a => new
                    {
                        a.Id,
                        a.Title,
                        a.Description,
                        a.Price,
                        a.DisplayOrder
                    }).ToList()
                })
                .ToListAsync();

            return Ok(new
            {
                data = profiles,
                pagination = new
                {
                    currentPage = page,
                    pageSize,
                    totalRecords = totalCount,
                    totalPages
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting billing profiles");
            return StatusCode(500, new { error = "An error occurred while retrieving billing profiles" });
        }
    }

    // GET: api/billingprofile/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetProfile(int id)
    {
        try
        {
            var profile = await _context.BillingProfiles
                .Include(p => p.ProfileWallets.OrderBy(w => w.DisplayOrder))
                .Include(p => p.ProfileAddons.OrderBy(a => a.DisplayOrder))
                .Where(p => p.Id == id)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.Price,
                    p.RadiusProfileId,
                    p.BillingGroupId,
                    p.IsActive,
                    p.IsDeleted,
                    p.DeletedAt,
                    p.CreatedAt,
                    p.UpdatedAt,
                    Wallets = p.ProfileWallets.Select(w => new
                    {
                        w.Id,
                        w.WalletType,
                        w.UserWalletId,
                        w.CustomWalletId,
                        price = w.Percentage,
                        w.Direction,
                        w.DisplayOrder
                    }).ToList(),
                    Addons = p.ProfileAddons.Select(a => new
                    {
                        a.Id,
                        a.Title,
                        a.Description,
                        a.Price,
                        a.DisplayOrder
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (profile == null)
            {
                return NotFound(new { error = "Billing profile not found" });
            }

            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting billing profile {id}");
            return StatusCode(500, new { error = "An error occurred while retrieving the billing profile" });
        }
    }

    // POST: api/billingprofile
    [HttpPost]
    public async Task<ActionResult<BillingProfile>> CreateProfile([FromBody] CreateBillingProfileRequest request)
    {
        try
        {
            // Check if profile with same name already exists
            var existingProfile = await _context.BillingProfiles
                .FirstOrDefaultAsync(p => p.Name.ToLower() == request.Name.ToLower() && !p.IsDeleted);
            
            if (existingProfile != null)
            {
                return BadRequest(new { error = "A billing profile with this name already exists" });
            }

            // Validate RadiusProfile exists
            var radiusProfile = await _context.RadiusProfiles.FindAsync(request.RadiusProfileId);
            if (radiusProfile == null)
            {
                return BadRequest(new { error = "Invalid radius profile" });
            }

            // Validate BillingGroup exists (skip if billingGroupId is 0 for "All Groups")
            if (request.BillingGroupId != 0)
            {
                var billingGroup = await _context.BillingGroups.FindAsync(request.BillingGroupId);
                if (billingGroup == null)
                {
                    return BadRequest(new { error = "Invalid billing group" });
                }
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            var profile = new BillingProfile
            {
                Name = request.Name,
                Description = request.Description,
                Price = request.Price,
                RadiusProfileId = request.RadiusProfileId,
                BillingGroupId = request.BillingGroupId == 0 ? null : request.BillingGroupId, // null means all groups
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userEmail,
                IsDeleted = false
            };

            _context.BillingProfiles.Add(profile);
            await _context.SaveChangesAsync();

            // Add wallets
            if (request.Wallets != null && request.Wallets.Any())
            {
                var wallets = request.Wallets.Select((w, index) => new BillingProfileWallet
                {
                    BillingProfileId = profile.Id,
                    WalletType = w.WalletType,
                    UserWalletId = w.UserWalletId,
                    CustomWalletId = w.CustomWalletId,
                    Percentage = w.Price,
                    Direction = w.Direction,
                    DisplayOrder = index
                }).ToList();

                _context.BillingProfileWallets.AddRange(wallets);
            }

            // Add addons
            if (request.Addons != null && request.Addons.Any())
            {
                var addons = request.Addons.Select((a, index) => new BillingProfileAddon
                {
                    BillingProfileId = profile.Id,
                    Title = a.Title,
                    Description = a.Description,
                    Price = a.Price,
                    DisplayOrder = index
                }).ToList();

                _context.BillingProfileAddons.AddRange(addons);
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProfile), new { id = profile.Id }, profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating billing profile");
            return StatusCode(500, new { error = "An error occurred while creating the billing profile" });
        }
    }

    // PUT: api/billingprofile/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProfile(int id, [FromBody] UpdateBillingProfileRequest request)
    {
        try
        {
            var existingProfile = await _context.BillingProfiles
                .Include(p => p.ProfileWallets)
                .Include(p => p.ProfileAddons)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (existingProfile == null)
            {
                return NotFound(new { error = "Billing profile not found" });
            }

            // Check if another profile with same name exists
            var duplicateName = await _context.BillingProfiles
                .FirstOrDefaultAsync(p => p.Name.ToLower() == request.Name.ToLower() 
                    && p.Id != id 
                    && !p.IsDeleted);
            
            if (duplicateName != null)
            {
                return BadRequest(new { error = "A billing profile with this name already exists" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            existingProfile.Name = request.Name;
            existingProfile.Description = request.Description;
            existingProfile.Price = request.Price;
            existingProfile.RadiusProfileId = request.RadiusProfileId;
            existingProfile.BillingGroupId = request.BillingGroupId == 0 ? null : request.BillingGroupId; // null means all groups
            existingProfile.UpdatedAt = DateTime.UtcNow;
            existingProfile.UpdatedBy = userEmail;

            // Update wallets - remove old ones and add new ones
            _context.BillingProfileWallets.RemoveRange(existingProfile.ProfileWallets);

            if (request.Wallets != null && request.Wallets.Any())
            {
                var wallets = request.Wallets.Select((w, index) => new BillingProfileWallet
                {
                    BillingProfileId = existingProfile.Id,
                    WalletType = w.WalletType,
                    UserWalletId = w.UserWalletId,
                    CustomWalletId = w.CustomWalletId,
                    Percentage = w.Price,
                    Direction = w.Direction,
                    DisplayOrder = index
                }).ToList();

                _context.BillingProfileWallets.AddRange(wallets);
            }

            // Update addons - remove old ones and add new ones
            _context.BillingProfileAddons.RemoveRange(existingProfile.ProfileAddons);

            if (request.Addons != null && request.Addons.Any())
            {
                var addons = request.Addons.Select((a, index) => new BillingProfileAddon
                {
                    BillingProfileId = existingProfile.Id,
                    Title = a.Title,
                    Description = a.Description,
                    Price = a.Price,
                    DisplayOrder = index
                }).ToList();

                _context.BillingProfileAddons.AddRange(addons);
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error updating billing profile {id}");
            return StatusCode(500, new { error = "An error occurred while updating the billing profile" });
        }
    }

    // DELETE: api/billingprofile/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProfile(int id)
    {
        try
        {
            var profile = await _context.BillingProfiles.FindAsync(id);

            if (profile == null)
            {
                return NotFound(new { error = "Billing profile not found" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            profile.IsDeleted = true;
            profile.DeletedAt = DateTime.UtcNow;
            profile.DeletedBy = userEmail;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error deleting billing profile {id}");
            return StatusCode(500, new { error = "An error occurred while deleting the billing profile" });
        }
    }

    // POST: api/billingprofile/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<ActionResult<BillingProfile>> RestoreProfile(int id)
    {
        try
        {
            var profile = await _context.BillingProfiles
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Id == id);

            if (profile == null)
            {
                return NotFound(new { error = "Billing profile not found" });
            }

            profile.IsDeleted = false;
            profile.DeletedAt = null;
            profile.DeletedBy = null;

            await _context.SaveChangesAsync();

            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error restoring billing profile {id}");
            return StatusCode(500, new { error = "An error occurred while restoring the billing profile" });
        }
    }
}

// Request DTOs
public class CreateBillingProfileRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int RadiusProfileId { get; set; }
    public int BillingGroupId { get; set; }
    public List<WalletConfigRequest>? Wallets { get; set; }
    public List<AddonConfigRequest>? Addons { get; set; }
}

public class UpdateBillingProfileRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int RadiusProfileId { get; set; }
    public int BillingGroupId { get; set; }
    public List<WalletConfigRequest>? Wallets { get; set; }
    public List<AddonConfigRequest>? Addons { get; set; }
}

public class WalletConfigRequest
{
    public string WalletType { get; set; } = null!;
    public int? UserWalletId { get; set; }
    public int? CustomWalletId { get; set; }
    public decimal Price { get; set; }
    public string? Direction { get; set; }
}

public class AddonConfigRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public decimal Price { get; set; }
}
