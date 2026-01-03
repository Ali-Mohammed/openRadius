using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{WorkspaceId}/radius/users")]
public class RadiusUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusUserController> _logger;

    public RadiusUserController(ApplicationDbContext context, ILogger<RadiusUserController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/workspaces/{WorkspaceId}/radius/users
    [HttpGet]
    public async Task<ActionResult<object>> GetUsers(
        int WorkspaceId, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Where(u => u.WorkspaceId == WorkspaceId && (includeDeleted || !u.IsDeleted));

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => 
                (u.Username != null && u.Username.ToLower().Contains(searchLower)) ||
                (u.Firstname != null && u.Firstname.ToLower().Contains(searchLower)) ||
                (u.Lastname != null && u.Lastname.ToLower().Contains(searchLower)) ||
                (u.Email != null && u.Email.ToLower().Contains(searchLower)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "username" => isDescending ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
                "name" => isDescending ? query.OrderByDescending(u => u.Firstname).ThenByDescending(u => u.Lastname) : query.OrderBy(u => u.Firstname).ThenBy(u => u.Lastname),
                "email" => isDescending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
                "phone" => isDescending ? query.OrderByDescending(u => u.Phone) : query.OrderBy(u => u.Phone),
                "city" => isDescending ? query.OrderByDescending(u => u.City) : query.OrderBy(u => u.City),
                "profile" => isDescending ? query.OrderByDescending(u => u.Profile!.Name) : query.OrderBy(u => u.Profile!.Name),
                "enabled" => isDescending ? query.OrderByDescending(u => u.Enabled) : query.OrderBy(u => u.Enabled),
                "balance" => isDescending ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
                "loanbalance" => isDescending ? query.OrderByDescending(u => u.LoanBalance) : query.OrderBy(u => u.LoanBalance),
                "expiration" => isDescending ? query.OrderByDescending(u => u.Expiration) : query.OrderBy(u => u.Expiration),
                "lastonline" => isDescending ? query.OrderByDescending(u => u.LastOnline) : query.OrderBy(u => u.LastOnline),
                "onlinestatus" => isDescending ? query.OrderByDescending(u => u.OnlineStatus) : query.OrderBy(u => u.OnlineStatus),
                "remainingdays" => isDescending ? query.OrderByDescending(u => u.RemainingDays) : query.OrderBy(u => u.RemainingDays),
                "debtdays" => isDescending ? query.OrderByDescending(u => u.DebtDays) : query.OrderBy(u => u.DebtDays),
                "staticip" => isDescending ? query.OrderByDescending(u => u.StaticIp) : query.OrderBy(u => u.StaticIp),
                "company" => isDescending ? query.OrderByDescending(u => u.Company) : query.OrderBy(u => u.Company),
                "address" => isDescending ? query.OrderByDescending(u => u.Address) : query.OrderBy(u => u.Address),
                "contractid" => isDescending ? query.OrderByDescending(u => u.ContractId) : query.OrderBy(u => u.ContractId),
                "simultaneoussessions" => isDescending ? query.OrderByDescending(u => u.SimultaneousSessions) : query.OrderBy(u => u.SimultaneousSessions),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(u => u.CreatedAt);
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
            ProfileName = u.Profile?.Name,
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
            SimultaneousSessions = u.SimultaneousSessions,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            LastSyncedAt = u.LastSyncedAt
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

    // GET: api/workspaces/{WorkspaceId}/radius/users/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusUserResponse>> GetUser(int WorkspaceId, int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.WorkspaceId == WorkspaceId);

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

    // POST: api/workspaces/{WorkspaceId}/radius/users
    [HttpPost]
    public async Task<ActionResult<RadiusUserResponse>> CreateUser(int WorkspaceId, [FromBody] CreateUserRequest request)
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
            WorkspaceId = WorkspaceId,
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

        return CreatedAtAction(nameof(GetUser), new { WorkspaceId, id = user.Id }, response);
    }

    // PUT: api/workspaces/{WorkspaceId}/radius/users/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<RadiusUserResponse>> UpdateUser(int WorkspaceId, int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.WorkspaceId == WorkspaceId);

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

    // DELETE: api/workspaces/{WorkspaceId}/radius/users/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int WorkspaceId, int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.WorkspaceId == WorkspaceId && !u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/workspaces/{WorkspaceId}/radius/users/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreUser(int WorkspaceId, int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.WorkspaceId == WorkspaceId && u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "Deleted user not found" });
        }

        user.IsDeleted = false;
        user.DeletedAt = null;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // GET: api/workspaces/{WorkspaceId}/radius/users/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedUsers(
        int WorkspaceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Where(u => u.WorkspaceId == WorkspaceId && u.IsDeleted);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = users.Select(u => new RadiusUserResponse
        {
            Id = u.Id,
            ExternalId = u.ExternalId,
            Username = u.Username,
            Firstname = u.Firstname,
            Lastname = u.Lastname,
            Email = u.Email,
            Phone = u.Phone,
            ProfileId = u.ProfileId,
            ProfileName = u.Profile?.Name,
            Balance = u.Balance,
            Enabled = u.Enabled,
            DeletedAt = u.DeletedAt,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt
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

    // POST: api/workspaces/{WorkspaceId}/radius/users/sync
    [HttpPost("sync")]
    public async Task<ActionResult<SyncUsersResponse>> SyncUsers(int WorkspaceId)
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
                "User sync completed for instant {WorkspaceId}. New: {New}, Updated: {Updated}, Failed: {Failed}",
                WorkspaceId, response.NewUsers, response.UpdatedUsers, response.FailedUsers
            );

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing users for instant {WorkspaceId}", WorkspaceId);

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



