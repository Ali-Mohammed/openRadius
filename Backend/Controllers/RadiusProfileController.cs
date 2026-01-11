using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using System.Security.Claims;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/profiles")]
public class RadiusProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ISasSyncService _syncService;
    private readonly ILogger<RadiusProfileController> _logger;

    public RadiusProfileController(
        ApplicationDbContext context, 
        MasterDbContext masterContext, 
        ISasSyncService syncService,
        ILogger<RadiusProfileController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _syncService = syncService;
        _logger = logger;
    }

    private async Task<int?> GetCurrentWorkspaceIdAsync()
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(userEmail)) return null;
        
        var user = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
        return user?.CurrentWorkspaceId;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetProfiles(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = null)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var query = _context.RadiusProfiles
            .Where(p => includeDeleted || !p.IsDeleted);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower();
            query = query.Where(p =>
                (p.Name != null && p.Name.ToLower().Contains(search)) ||
                (p.Pool != null && p.Pool.ToLower().Contains(search))
            );
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        // For usercount sorting, we need to materialize and sort in memory
        IEnumerable<RadiusProfile> profilesList;
        if (!string.IsNullOrWhiteSpace(sortField) && sortField.ToLower() == "usercount")
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            
            // Load all profiles with user counts using a left join approach
            var profilesWithCounts = await query
                .Select(p => new { 
                    Profile = p, 
                    UserCount = _context.RadiusUsers
                        .Count(u => !u.IsDeleted && u.ProfileId == p.Id)
                })
                .ToListAsync();
            
            // Sort in memory and paginate
            var sortedProfiles = isDescending 
                ? profilesWithCounts.OrderByDescending(p => p.UserCount)
                : profilesWithCounts.OrderBy(p => p.UserCount);
            
            profilesList = sortedProfiles
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => p.Profile);
        }
        else
        {
            // Apply sorting for other fields
            if (!string.IsNullOrWhiteSpace(sortField))
            {
                var isDescending = sortDirection?.ToLower() == "desc";
                query = sortField.ToLower() switch
                {
                    "name" => isDescending ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
                    "enabled" => isDescending ? query.OrderByDescending(p => p.Enabled) : query.OrderBy(p => p.Enabled),
                    "downrate" => isDescending ? query.OrderByDescending(p => p.Downrate) : query.OrderBy(p => p.Downrate),
                    "uprate" => isDescending ? query.OrderByDescending(p => p.Uprate) : query.OrderBy(p => p.Uprate),
                    "price" => isDescending ? query.OrderByDescending(p => p.Price) : query.OrderBy(p => p.Price),
                    "pool" => isDescending ? query.OrderByDescending(p => p.Pool) : query.OrderBy(p => p.Pool),
                    "monthly" => isDescending ? query.OrderByDescending(p => p.Monthly) : query.OrderBy(p => p.Monthly),
                    "type" => isDescending ? query.OrderByDescending(p => p.Type) : query.OrderBy(p => p.Type),
                    _ => query.OrderByDescending(p => p.CreatedAt)
                };
            }
            else
            {
                query = query.OrderByDescending(p => p.CreatedAt);
            }
            
            profilesList = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        // Calculate actual user counts for each profile
        var profiles = new List<RadiusProfileResponse>();
        foreach (var p in profilesList)
        {
            var userCount = await _context.RadiusUsers
                .CountAsync(u => !u.IsDeleted && 
                                 u.ProfileId == p.Id);

            // Get custom wallets for this profile
            var profileWallets = await _context.RadiusProfileWallets
                .Include(pw => pw.CustomWallet)
                .Where(pw => pw.RadiusProfileId == p.Id)
                .Select(pw => new ProfileWalletConfig
                {
                    CustomWalletId = pw.CustomWalletId,
                    Amount = pw.Amount,
                    WalletName = pw.CustomWallet.Name
                })
                .ToListAsync();

            profiles.Add(new RadiusProfileResponse
            {
                Id = p.Id,
                ExternalId = p.ExternalId,
                Name = p.Name,
                Enabled = p.Enabled,
                Type = p.Type,
                Downrate = p.Downrate,
                Uprate = p.Uprate,
                Pool = p.Pool,
                Price = p.Price,
                Monthly = p.Monthly,
                BurstEnabled = p.BurstEnabled,
                LimitExpiration = p.LimitExpiration,
                ExpirationAmount = p.ExpirationAmount,
                ExpirationUnit = p.ExpirationUnit,
                SiteId = p.SiteId,
                OnlineUsersCount = p.OnlineUsersCount,
                UsersCount = userCount,
                Color = p.Color,
                Icon = p.Icon,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt,
                CustomWallets = profileWallets
            });
        }

        return Ok(new
        {
            data = profiles,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusProfileResponse>> GetProfile(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var profile = await _context.RadiusProfiles
            .Where(p => p.Id == id)
            .FirstOrDefaultAsync();

        if (profile == null)
        {
            return NotFound();
        }

        // Calculate actual user count
        var userCount = await _context.RadiusUsers
            .CountAsync(u => !u.IsDeleted && 
                             u.ProfileId == profile.Id);

        // Get custom wallets linked to this profile
        var profileWallets = await _context.RadiusProfileWallets
            .Include(pw => pw.CustomWallet)
            .Where(pw => pw.RadiusProfileId == profile.Id)
            .Select(pw => new ProfileWalletConfig
            {
                CustomWalletId = pw.CustomWalletId,
                Amount = pw.Amount,
                WalletName = pw.CustomWallet.Name
            })
            .ToListAsync();

        var response = new RadiusProfileResponse
        {
            Id = profile.Id,
            ExternalId = profile.ExternalId,
            Name = profile.Name,
            Enabled = profile.Enabled,
            Type = profile.Type,
            Downrate = profile.Downrate,
            Uprate = profile.Uprate,
            Pool = profile.Pool,
            Price = profile.Price,
            Monthly = profile.Monthly,
            BurstEnabled = profile.BurstEnabled,
            LimitExpiration = profile.LimitExpiration,
            ExpirationAmount = profile.ExpirationAmount,
            ExpirationUnit = profile.ExpirationUnit,
            SiteId = profile.SiteId,
            OnlineUsersCount = profile.OnlineUsersCount,
            UsersCount = userCount,
            Color = profile.Color,
            Icon = profile.Icon,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt,
            LastSyncedAt = profile.LastSyncedAt,
            CustomWallets = profileWallets
        };

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<RadiusProfileResponse>> CreateProfile([FromBody] CreateProfileRequest request)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var workspace = await _masterContext.Workspaces.FindAsync(workspaceId.Value);
        if (workspace == null)
        {
            return NotFound($"Workspace with ID {workspaceId} not found");
        }

        var profile = new RadiusProfile
        {
            Name = request.Name,
            Enabled = request.Enabled,
            Type = request.Type,
            Downrate = request.Downrate,
            Uprate = request.Uprate,
            Pool = request.Pool,
            Price = request.Price,
            Monthly = request.Monthly,
            BurstEnabled = request.BurstEnabled,
            LimitExpiration = request.LimitExpiration,
            ExpirationAmount = request.ExpirationAmount,
            ExpirationUnit = request.ExpirationUnit,
            SiteId = request.SiteId,
            Color = request.Color,
            Icon = request.Icon,
            ExternalId = 0,
            OnlineUsersCount = 0,
            UsersCount = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSyncedAt = DateTime.UtcNow
        };

        _context.RadiusProfiles.Add(profile);
        await _context.SaveChangesAsync();

        // Add custom wallet links if provided
        if (request.CustomWallets != null && request.CustomWallets.Any())
        {
            foreach (var wallet in request.CustomWallets)
            {
                var profileWallet = new RadiusProfileWallet
                {
                    RadiusProfileId = profile.Id,
                    CustomWalletId = wallet.CustomWalletId,
                    Amount = wallet.Amount,
                    CreatedAt = DateTime.UtcNow
                };
                _context.RadiusProfileWallets.Add(profileWallet);
            }
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation("Created radius profile {Name} for workspace {WorkspaceId}", profile.Name, workspaceId.Value);

        // Get wallet names for response
        var profileWallets = request.CustomWallets?.Select(w => new ProfileWalletConfig
        {
            CustomWalletId = w.CustomWalletId,
            Amount = w.Amount,
            WalletName = _context.CustomWallets.FirstOrDefault(cw => cw.Id == w.CustomWalletId)?.Name
        }).ToList() ?? new List<ProfileWalletConfig>();

        var response = new RadiusProfileResponse
        {
            Id = profile.Id,
            ExternalId = profile.ExternalId,
            Name = profile.Name,
            Enabled = profile.Enabled,
            Type = profile.Type,
            Downrate = profile.Downrate,
            Uprate = profile.Uprate,
            Pool = profile.Pool,
            Price = profile.Price,
            Monthly = profile.Monthly,
            BurstEnabled = profile.BurstEnabled,
            LimitExpiration = profile.LimitExpiration,
            ExpirationAmount = profile.ExpirationAmount,
            ExpirationUnit = profile.ExpirationUnit,
            SiteId = profile.SiteId,
            OnlineUsersCount = profile.OnlineUsersCount,
            UsersCount = profile.UsersCount,
            Color = profile.Color,
            Icon = profile.Icon,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt,
            LastSyncedAt = profile.LastSyncedAt,
            CustomWallets = profileWallets
        };

        return CreatedAtAction(nameof(GetProfile), new { id = profile.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProfile(int id, [FromBody] UpdateProfileRequest request)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id);

        if (profile == null)
        {
            return NotFound();
        }

        profile.Name = request.Name;
        profile.Enabled = request.Enabled;
        profile.Type = request.Type;
        profile.Downrate = request.Downrate;
        profile.Uprate = request.Uprate;
        profile.Pool = request.Pool;
        profile.Price = request.Price;
        profile.Monthly = request.Monthly;
        profile.BurstEnabled = request.BurstEnabled;
        profile.LimitExpiration = request.LimitExpiration;
        profile.ExpirationAmount = request.ExpirationAmount;
        profile.ExpirationUnit = request.ExpirationUnit;
        profile.SiteId = request.SiteId;
        profile.Color = request.Color;
        profile.Icon = request.Icon;
        profile.UpdatedAt = DateTime.UtcNow;

        // Update custom wallet links
        if (request.CustomWallets != null)
        {
            // Remove existing wallet links
            var existingWallets = await _context.RadiusProfileWallets
                .Where(pw => pw.RadiusProfileId == id)
                .ToListAsync();
            _context.RadiusProfileWallets.RemoveRange(existingWallets);

            // Add new wallet links
            foreach (var wallet in request.CustomWallets)
            {
                var profileWallet = new RadiusProfileWallet
                {
                    RadiusProfileId = profile.Id,
                    CustomWalletId = wallet.CustomWalletId,
                    Amount = wallet.Amount,
                    CreatedAt = DateTime.UtcNow
                };
                _context.RadiusProfileWallets.Add(profileWallet);
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated radius profile {Name} for workspace {WorkspaceId}", profile.Name, workspaceId.Value);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProfile(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (profile == null)
        {
            return NotFound();
        }

        profile.IsDeleted = true;
        profile.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Soft deleted radius profile {Name} for workspace {WorkspaceId}", profile.Name, workspaceId.Value);

        return NoContent();
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreProfile(int id)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);

        if (profile == null)
        {
            return NotFound(new { message = "Deleted profile not found" });
        }

        profile.IsDeleted = false;
        profile.DeletedAt = null;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Restored radius profile {Name} for workspace {WorkspaceId}", profile.Name, workspaceId.Value);

        return NoContent();
    }

    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedProfiles(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var workspaceId = await GetCurrentWorkspaceIdAsync();
        if (workspaceId == null)
        {
            return Unauthorized(new { message = "User workspace not found" });
        }

        var query = _context.RadiusProfiles
            .Where(p => p.IsDeleted);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var profilesList = await query
            .OrderByDescending(p => p.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Calculate actual user counts for each profile
        var profiles = new List<RadiusProfileResponse>();
        foreach (var p in profilesList)
        {
            var userCount = await _context.RadiusUsers
                .CountAsync(u => !u.IsDeleted && 
                                 u.ProfileId == p.Id);

            profiles.Add(new RadiusProfileResponse
            {
                Id = p.Id,
                ExternalId = p.ExternalId,
                Name = p.Name,
                Enabled = p.Enabled,
                Type = p.Type,
                Downrate = p.Downrate,
                Uprate = p.Uprate,
                Pool = p.Pool,
                Price = p.Price,
                Monthly = p.Monthly,
                BurstEnabled = p.BurstEnabled,
                LimitExpiration = p.LimitExpiration,
                ExpirationAmount = p.ExpirationAmount,
                ExpirationUnit = p.ExpirationUnit,
                SiteId = p.SiteId,
                OnlineUsersCount = p.OnlineUsersCount,
                UsersCount = userCount,
                Color = p.Color,
                Icon = p.Icon,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt
            });
        }

        return Ok(new
        {
            data = profiles,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    [HttpPost("sync")]
    public async Task<ActionResult<SyncProfileResponse>> SyncProfiles([FromQuery] bool fullSync = false)
    {
        int? workspaceId = null;
        try
        {
            workspaceId = await GetCurrentWorkspaceIdAsync();
            if (workspaceId == null)
            {
                return Unauthorized(new { message = "User workspace not found" });
            }

            // Get the active SAS Radius integration for this workspace
            var integration = await _context.SasRadiusIntegrations
                .FirstOrDefaultAsync(i => i.IsActive && !i.IsDeleted);

            if (integration == null)
            {
                return BadRequest(new { error = "No active SAS Radius integration found for this workspace" });
            }

            // Start the sync using the SAS sync service
            var syncId = await _syncService.SyncAsync(integration.Id, workspaceId.Value, fullSync);
            
            _logger.LogInformation("Started profile sync {SyncId} for workspace {WorkspaceId}", syncId, workspaceId.Value);

            return Ok(new
            {
                syncId = syncId.ToString(),
                message = "Profile sync started successfully. Connect to SignalR hub at /hubs/sassync and join group with syncId to receive real-time updates.",
                integrationId = integration.Id,
                integrationName = integration.Name,
                workspaceId = workspaceId.Value
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start profile sync for workspace {WorkspaceId}", workspaceId?.ToString() ?? "unknown");
            return StatusCode(500, new { error = "Failed to start profile synchronization", details = ex.Message });
        }
    }
}





