using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/instants/{instantId}/radius/users")]
public class RadiusUserController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ILogger<RadiusUserController> _logger;

    public RadiusUserController(MasterDbContext context, ILogger<RadiusUserController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/instants/{instantId}/radius/users
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RadiusUserResponse>>> GetUsers(int instantId)
    {
        var users = await _context.RadiusUsers
            .Where(u => u.InstantId == instantId)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        var response = users.Select(u => new RadiusUserResponse
        {
            Id = u.Id,
            ExternalId = u.ExternalId,
            Username = u.Username,
            Firstname = u.Firstname,
            Lastname = u.Lastname,
            City = u.City,
            Phone = u.Phone,
            Email = u.Email,
            ProfileId = u.ProfileId,
            Balance = u.Balance,
            LoanBalance = u.LoanBalance,
            Expiration = u.Expiration,
            LastOnline = u.LastOnline,
            Enabled = u.Enabled,
            OnlineStatus = u.OnlineStatus,
            RemainingDays = u.RemainingDays,
            DebtDays = u.DebtDays,
            StaticIp = u.StaticIp,
            Company = u.Company,
            Address = u.Address,
            ContractId = u.ContractId,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            LastSyncedAt = u.LastSyncedAt
        });

        return Ok(response);
    }

    // GET: api/instants/{instantId}/radius/users/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusUserResponse>> GetUser(int instantId, int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.InstantId == instantId);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var response = new RadiusUserResponse
        {
            Id = user.Id,
            ExternalId = user.ExternalId,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            City = user.City,
            Phone = user.Phone,
            Email = user.Email,
            ProfileId = user.ProfileId,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            Enabled = user.Enabled,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = user.RemainingDays,
            DebtDays = user.DebtDays,
            StaticIp = user.StaticIp,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return Ok(response);
    }

    // POST: api/instants/{instantId}/radius/users
    [HttpPost]
    public async Task<ActionResult<RadiusUserResponse>> CreateUser(int instantId, [FromBody] CreateUserRequest request)
    {
        var user = new RadiusUser
        {
            ExternalId = 0, // Will be set when synced with SAS
            Username = request.Username,
            Firstname = request.Firstname,
            Lastname = request.Lastname,
            Email = request.Email,
            Phone = request.Phone,
            City = request.City,
            ProfileId = request.ProfileId,
            Balance = request.Balance,
            Expiration = request.Expiration,
            Enabled = request.Enabled,
            StaticIp = request.StaticIp,
            Company = request.Company,
            Address = request.Address,
            ContractId = request.ContractId,
            SimultaneousSessions = request.SimultaneousSessions,
            InstantId = instantId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.RadiusUsers.Add(user);
        await _context.SaveChangesAsync();

        var response = new RadiusUserResponse
        {
            Id = user.Id,
            ExternalId = user.ExternalId,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            City = user.City,
            Phone = user.Phone,
            Email = user.Email,
            ProfileId = user.ProfileId,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            Enabled = user.Enabled,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = user.RemainingDays,
            DebtDays = user.DebtDays,
            StaticIp = user.StaticIp,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return CreatedAtAction(nameof(GetUser), new { instantId, id = user.Id }, response);
    }

    // PUT: api/instants/{instantId}/radius/users/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<RadiusUserResponse>> UpdateUser(int instantId, int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.InstantId == instantId);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Update only provided fields
        if (request.Username != null) user.Username = request.Username;
        if (request.Firstname != null) user.Firstname = request.Firstname;
        if (request.Lastname != null) user.Lastname = request.Lastname;
        if (request.Email != null) user.Email = request.Email;
        if (request.Phone != null) user.Phone = request.Phone;
        if (request.City != null) user.City = request.City;
        if (request.ProfileId.HasValue) user.ProfileId = request.ProfileId;
        if (request.Balance.HasValue) user.Balance = request.Balance.Value;
        if (request.Expiration.HasValue) user.Expiration = request.Expiration;
        if (request.Enabled.HasValue) user.Enabled = request.Enabled.Value;
        if (request.StaticIp != null) user.StaticIp = request.StaticIp;
        if (request.Company != null) user.Company = request.Company;
        if (request.Address != null) user.Address = request.Address;
        if (request.ContractId != null) user.ContractId = request.ContractId;
        if (request.SimultaneousSessions.HasValue) user.SimultaneousSessions = request.SimultaneousSessions.Value;

        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = new RadiusUserResponse
        {
            Id = user.Id,
            ExternalId = user.ExternalId,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            City = user.City,
            Phone = user.Phone,
            Email = user.Email,
            ProfileId = user.ProfileId,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            Enabled = user.Enabled,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = user.RemainingDays,
            DebtDays = user.DebtDays,
            StaticIp = user.StaticIp,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return Ok(response);
    }

    // DELETE: api/instants/{instantId}/radius/users/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int instantId, int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.InstantId == instantId);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        _context.RadiusUsers.Remove(user);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/instants/{instantId}/radius/users/sync
    [HttpPost("sync")]
    public async Task<ActionResult<SyncUsersResponse>> SyncUsers(int instantId)
    {
        var syncStartTime = DateTime.UtcNow;
        var syncId = Guid.NewGuid().ToString();

        try
        {
            // TODO: Implement actual SAS Radius server sync
            // This is a placeholder that returns mock data
            
            // For now, return a mock successful sync response
            var response = new SyncUsersResponse
            {
                SyncId = syncId,
                Success = true,
                Message = "Sync completed successfully",
                TotalUsers = 0,
                NewUsers = 0,
                UpdatedUsers = 0,
                FailedUsers = 0,
                StartedAt = syncStartTime,
                CompletedAt = DateTime.UtcNow,
                ErrorMessage = null
            };

            _logger.LogInformation(
                "User sync completed for instant {InstantId}. New: {New}, Updated: {Updated}, Failed: {Failed}",
                instantId, response.NewUsers, response.UpdatedUsers, response.FailedUsers
            );

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing users for instant {InstantId}", instantId);

            var response = new SyncUsersResponse
            {
                SyncId = syncId,
                Success = false,
                Message = "Sync failed",
                TotalUsers = 0,
                NewUsers = 0,
                UpdatedUsers = 0,
                FailedUsers = 0,
                StartedAt = syncStartTime,
                CompletedAt = DateTime.UtcNow,
                ErrorMessage = ex.Message
            };

            return StatusCode(500, response);
        }
    }
}
