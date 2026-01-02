using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/instants/{instantId}/radius/profiles")]
public class RadiusProfileController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ILogger<RadiusProfileController> _logger;

    public RadiusProfileController(MasterDbContext context, ILogger<RadiusProfileController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RadiusProfileResponse>>> GetProfiles(int instantId)
    {
        var profiles = await _context.RadiusProfiles
            .Where(p => p.InstantId == instantId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new RadiusProfileResponse
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
                UsersCount = p.UsersCount,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt
            })
            .ToListAsync();

        return Ok(profiles);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusProfileResponse>> GetProfile(int instantId, int id)
    {
        var profile = await _context.RadiusProfiles
            .Where(p => p.Id == id && p.InstantId == instantId)
            .Select(p => new RadiusProfileResponse
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
                UsersCount = p.UsersCount,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt
            })
            .FirstOrDefaultAsync();

        if (profile == null)
        {
            return NotFound();
        }

        return Ok(profile);
    }

    [HttpPost]
    public async Task<ActionResult<RadiusProfileResponse>> CreateProfile(int instantId, [FromBody] CreateProfileRequest request)
    {
        var instant = await _context.Instants.FindAsync(instantId);
        if (instant == null)
        {
            return NotFound($"Instant with ID {instantId} not found");
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
            InstantId = instantId,
            ExternalId = 0,
            OnlineUsersCount = 0,
            UsersCount = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSyncedAt = DateTime.UtcNow
        };

        _context.RadiusProfiles.Add(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created radius profile {Name} for instant {InstantId}", profile.Name, instantId);

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
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt,
            LastSyncedAt = profile.LastSyncedAt
        };

        return CreatedAtAction(nameof(GetProfile), new { instantId, id = profile.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProfile(int instantId, int id, [FromBody] UpdateProfileRequest request)
    {
        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.InstantId == instantId);

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
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated radius profile {Name} for instant {InstantId}", profile.Name, instantId);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProfile(int instantId, int id)
    {
        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.InstantId == instantId);

        if (profile == null)
        {
            return NotFound();
        }

        _context.RadiusProfiles.Remove(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted radius profile {Name} for instant {InstantId}", profile.Name, instantId);

        return NoContent();
    }

    [HttpPost("sync")]
    public async Task<ActionResult<SyncProfileResponse>> SyncProfiles(int instantId)
    {
        var syncId = Guid.NewGuid().ToString();
        var startedAt = DateTime.UtcNow;

        try
        {
            // TODO: Implement actual sync with SAS Radius server
            // For now, return a mock response
            
            var response = new SyncProfileResponse
            {
                SyncId = syncId,
                Success = true,
                Message = "Sync completed successfully",
                TotalProfiles = 0,
                NewProfiles = 0,
                UpdatedProfiles = 0,
                FailedProfiles = 0,
                StartedAt = startedAt,
                CompletedAt = DateTime.UtcNow
            };

            _logger.LogInformation("Synced radius profiles for instant {InstantId}. SyncId: {SyncId}", instantId, syncId);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync radius profiles for instant {InstantId}", instantId);

            return Ok(new SyncProfileResponse
            {
                SyncId = syncId,
                Success = false,
                Message = "Sync failed",
                TotalProfiles = 0,
                NewProfiles = 0,
                UpdatedProfiles = 0,
                FailedProfiles = 0,
                StartedAt = startedAt,
                CompletedAt = DateTime.UtcNow,
                ErrorMessage = ex.Message
            });
        }
    }
}
