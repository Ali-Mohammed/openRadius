using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

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
            profile.UpdatedBy = User.GetSystemUserId();

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
                .OrderBy(p => p.Priority ?? int.MaxValue)
                .ThenByDescending(p => p.CreatedAt)
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
                    p.AutomationId,
                    AutomationTitle = p.Automation != null ? p.Automation.Title : null,
                    p.IsActive,
                    p.IsDeleted,
                    p.DeletedAt,
                    p.CreatedAt,
                    p.UpdatedAt,
                    p.IsOffer,
                    p.Platform,
                    p.TotalQuantity,
                    p.UsedQuantity,
                    p.UserType,
                    p.ExpirationDays,
                    p.OfferStartDate,
                    p.OfferEndDate,
                    p.RequiresApproval,
                    p.Priority,
                    p.Color,
                    p.Icon,
                    UserIds = p.ProfileUsers.Select(pu => pu.UserId).ToList(),
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
                .Include(p => p.ProfileUsers)
                .Where(p => p.Id == id)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.Price,
                    p.RadiusProfileId,
                    p.BillingGroupId,
                    p.AutomationId,
                    AutomationTitle = p.Automation != null ? p.Automation.Title : null,
                    p.IsActive,
                    p.IsDeleted,
                    p.DeletedAt,
                    p.CreatedAt,
                    p.UpdatedAt,
                    p.IsOffer,
                    p.Platform,
                    p.TotalQuantity,
                    p.UsedQuantity,
                    p.UserType,
                    p.ExpirationDays,
                    p.OfferStartDate,
                    p.OfferEndDate,
                    p.RequiresApproval,
                    p.Priority,
                    p.Color,
                    p.Icon,
                    UserIds = p.ProfileUsers.Select(pu => pu.UserId).ToList(),
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

            // Validate RadiusProfile exists (optional)
            if (request.RadiusProfileId.HasValue && request.RadiusProfileId.Value > 0)
            {
                var radiusProfile = await _context.RadiusProfiles.FindAsync(request.RadiusProfileId.Value);
                if (radiusProfile == null)
                {
                    return BadRequest(new { error = "Invalid radius profile" });
                }
            }

            // Validate Automation exists (optional)
            if (request.AutomationId.HasValue && request.AutomationId.Value > 0)
            {
                var automation = await _context.Automations.FindAsync(request.AutomationId.Value);
                if (automation == null)
                {
                    return BadRequest(new { error = "Invalid automation" });
                }
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

            var profile = new BillingProfile
            {
                Name = request.Name,
                Description = request.Description,
                Price = request.Price,
                RadiusProfileId = (request.RadiusProfileId.HasValue && request.RadiusProfileId.Value > 0) ? request.RadiusProfileId : null,
                BillingGroupId = request.BillingGroupId == 0 ? null : request.BillingGroupId, // null means all groups
                AutomationId = (request.AutomationId.HasValue && request.AutomationId.Value > 0) ? request.AutomationId : null,
                
                // Advanced Options
                IsOffer = request.IsOffer,
                Platform = request.Platform,
                TotalQuantity = request.TotalQuantity,
                UsedQuantity = 0,
                UserType = request.UserType,
                ExpirationDays = request.ExpirationDays,
                OfferStartDate = request.OfferStartDate,
                OfferEndDate = request.OfferEndDate,
                RequiresApproval = request.RequiresApproval,
                Priority = request.Priority,
                Color = request.Color,
                Icon = request.Icon,
                
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId(),
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

            // Add direct user assignments
            if (request.UserIds != null && request.UserIds.Any())
            {
                var profileUsers = request.UserIds.Select(userId => new BillingProfileUser
                {
                    BillingProfileId = profile.Id,
                    UserId = userId,
                    AssignedAt = DateTime.UtcNow,
                    AssignedBy = User.GetSystemUserId()
                }).ToList();

                _context.BillingProfileUsers.AddRange(profileUsers);
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
            _logger.LogInformation($"UpdateProfile - Received Color: {request.Color}, Icon: {request.Icon}");
            
            var existingProfile = await _context.BillingProfiles
                .Include(p => p.ProfileWallets)
                .Include(p => p.ProfileAddons)
                .Include(p => p.ProfileUsers)
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

            existingProfile.Name = request.Name;
            existingProfile.Description = request.Description;
            existingProfile.Price = request.Price;
            existingProfile.RadiusProfileId = (request.RadiusProfileId.HasValue && request.RadiusProfileId.Value > 0) ? request.RadiusProfileId : null;
            existingProfile.BillingGroupId = request.BillingGroupId == 0 ? null : request.BillingGroupId; // null means all groups
            existingProfile.AutomationId = (request.AutomationId.HasValue && request.AutomationId.Value > 0) ? request.AutomationId : null;
            
            // Advanced Options
            existingProfile.IsOffer = request.IsOffer;
            existingProfile.Platform = request.Platform;
            existingProfile.TotalQuantity = request.TotalQuantity;
            existingProfile.UserType = request.UserType;
            existingProfile.ExpirationDays = request.ExpirationDays;
            existingProfile.OfferStartDate = request.OfferStartDate;
            existingProfile.OfferEndDate = request.OfferEndDate;
            existingProfile.RequiresApproval = request.RequiresApproval;
            existingProfile.Priority = request.Priority;
            existingProfile.Color = request.Color;
            existingProfile.Icon = request.Icon;
            
            existingProfile.UpdatedAt = DateTime.UtcNow;
            existingProfile.UpdatedBy = User.GetSystemUserId();

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

            // Update direct user assignments - remove old ones and add new ones
            _context.BillingProfileUsers.RemoveRange(existingProfile.ProfileUsers);

            if (request.UserIds != null && request.UserIds.Any())
            {
                var profileUsers = request.UserIds.Select(userId => new BillingProfileUser
                {
                    BillingProfileId = existingProfile.Id,
                    UserId = userId,
                    AssignedAt = DateTime.UtcNow,
                    AssignedBy = User.GetSystemUserId()
                }).ToList();

                _context.BillingProfileUsers.AddRange(profileUsers);
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

            profile.IsDeleted = true;
            profile.DeletedAt = DateTime.UtcNow;
            profile.DeletedBy = User.GetSystemUserId();

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

    // POST: api/billingprofile/reorder
    [HttpPost("reorder")]
    public async Task<IActionResult> ReorderProfiles([FromBody] List<ReorderProfileRequest> items)
    {
        try
        {
            foreach (var item in items)
            {
                var profile = await _context.BillingProfiles.FindAsync(item.Id);
                if (profile != null)
                {
                    profile.Priority = item.Priority;
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering billing profiles");
            return StatusCode(500, new { error = "An error occurred while reordering profiles" });
        }
    }
}

public class ReorderProfileRequest
{
    public int Id { get; set; }
    public Guid Uuid { get; set; }
    public int Priority { get; set; }
}

// Request DTOs
public class CreateBillingProfileRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int? RadiusProfileId { get; set; } // Optional
    public int BillingGroupId { get; set; }
    public int? AutomationId { get; set; } // Optional automation to run
    public List<int>? UserIds { get; set; } // Direct user assignment
    public List<WalletConfigRequest>? Wallets { get; set; }
    public List<AddonConfigRequest>? Addons { get; set; }
    
    // Advanced Options
    public bool IsOffer { get; set; } = false;
    public string? Platform { get; set; }
    public int? TotalQuantity { get; set; }
    public string? UserType { get; set; }
    public int? ExpirationDays { get; set; }
    public DateTime? OfferStartDate { get; set; }
    public DateTime? OfferEndDate { get; set; }
    public bool RequiresApproval { get; set; } = false;
    public int? Priority { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
}

public class UpdateBillingProfileRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int? RadiusProfileId { get; set; } // Optional
    public int BillingGroupId { get; set; }
    public int? AutomationId { get; set; } // Optional automation to run
    public List<int>? UserIds { get; set; } // Direct user assignment
    public List<WalletConfigRequest>? Wallets { get; set; }
    public List<AddonConfigRequest>? Addons { get; set; }
    
    // Advanced Options
    public bool IsOffer { get; set; } = false;
    public string? Platform { get; set; }
    public int? TotalQuantity { get; set; }
    public string? UserType { get; set; }
    public int? ExpirationDays { get; set; }
    public DateTime? OfferStartDate { get; set; }
    public DateTime? OfferEndDate { get; set; }
    public bool RequiresApproval { get; set; } = false;
    public int? Priority { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
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
