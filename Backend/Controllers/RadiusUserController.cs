using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using System.Text;
using OfficeOpenXml;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/users")]
public class RadiusUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusUserController> _logger;

    public RadiusUserController(ApplicationDbContext context, ILogger<RadiusUserController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/radius/users
    [HttpGet]
    public async Task<ActionResult<object>> GetUsers(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Include(u => u.RadiusGroup)
            .Include(u => u.RadiusUserTags)
                .ThenInclude(ut => ut.RadiusTag)
            .Where(u => includeDeleted || !u.IsDeleted);

        // Get IP reservations for users
        var ipReservations = await _context.RadiusIpReservations
            .Where(r => r.DeletedAt == null)
            .ToListAsync();
        var userIpMap = ipReservations
            .Where(r => r.RadiusUserId.HasValue)
            .GroupBy(r => r.RadiusUserId!.Value)
            .ToDictionary(g => g.Key, g => g.First().IpAddress);

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
                "notes" => isDescending ? query.OrderByDescending(u => u.Notes) : query.OrderBy(u => u.Notes),
                "deviceserialnumber" => isDescending ? query.OrderByDescending(u => u.DeviceSerialNumber) : query.OrderBy(u => u.DeviceSerialNumber),
                "gpslat" => isDescending ? query.OrderByDescending(u => u.GpsLat) : query.OrderBy(u => u.GpsLat),
                "gpslng" => isDescending ? query.OrderByDescending(u => u.GpsLng) : query.OrderBy(u => u.GpsLng),
                "simultaneoussessions" => isDescending ? query.OrderByDescending(u => u.SimultaneousSessions) : query.OrderBy(u => u.SimultaneousSessions),
                "createdat" => isDescending ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
                "updatedat" => isDescending ? query.OrderByDescending(u => u.UpdatedAt) : query.OrderBy(u => u.UpdatedAt),
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
            StaticIp = userIpMap.ContainsKey(u.Id) ? userIpMap[u.Id] : null,
            Company = u.Company,
            Address = u.Address,
            ContractId = u.ContractId,
            Notes = u.Notes,
            DeviceSerialNumber = u.DeviceSerialNumber,
            GpsLat = u.GpsLat,
            GpsLng = u.GpsLng,
            SimultaneousSessions = u.SimultaneousSessions,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            LastSyncedAt = u.LastSyncedAt,
            ZoneId = u.ZoneId,
            ZoneName = u.Zone != null ? u.Zone.Name : null,
            ZoneColor = u.Zone != null ? u.Zone.Color : null,
            GroupId = u.GroupId,
            GroupName = u.RadiusGroup != null ? u.RadiusGroup.Name : null,
            Tags = u.RadiusUserTags.Select(ut => new RadiusTagResponse
            {
                Id = ut.RadiusTag.Id,
                Title = ut.RadiusTag.Title,
                Description = ut.RadiusTag.Description,
                Status = ut.RadiusTag.Status,
                Color = ut.RadiusTag.Color,
                Icon = ut.RadiusTag.Icon,
                CreatedAt = ut.RadiusTag.CreatedAt,
                UpdatedAt = ut.RadiusTag.UpdatedAt
            }).ToList()
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

    // GET: api/radius/users/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusUserResponse>> GetUser(int id)
    {
        var user = await _context.RadiusUsers
            .Include(u => u.RadiusGroup)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Get IP reservation for this user
        var ipReservation = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId == id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

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
            StaticIp = ipReservation?.IpAddress,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            Notes = user.Notes,
            GpsLat = user.GpsLat,
            GpsLng = user.GpsLng,
            GroupId = user.GroupId,
            GroupName = user.RadiusGroup != null ? user.RadiusGroup.Name : null,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return Ok(response);
    }

    // POST: api/radius/users
    [HttpPost]
    public async Task<ActionResult<RadiusUserResponse>> CreateUser([FromBody] CreateUserRequest request)
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
            // StaticIp is managed via IP Reservations, not set here
            Company = request.Company,
            Address = request.Address,
            ContractId = request.ContractId,
            Notes = request.Notes,
            DeviceSerialNumber = request.DeviceSerialNumber,
            GpsLat = request.GpsLat,
            GpsLng = request.GpsLng,
            SimultaneousSessions = request.SimultaneousSessions,
            ZoneId = request.ZoneId,
            GroupId = request.GroupId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.RadiusUsers.Add(user);
        await _context.SaveChangesAsync();

        // Add password to radcheck table if provided
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            // Remove existing password entries for this user
            var existingPasswords = _context.Set<Dictionary<string, object>>("radcheck")
                .FromSqlRaw("SELECT * FROM radcheck WHERE username = {0} AND attribute = 'Cleartext-Password'", user.Username)
                .ToList();
            
            if (existingPasswords.Any())
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "DELETE FROM radcheck WHERE username = {0} AND attribute = 'Cleartext-Password'",
                    user.Username);
            }

            // Insert new password
            await _context.Database.ExecuteSqlRawAsync(
                "INSERT INTO radcheck (username, attribute, op, value) VALUES ({0}, 'Cleartext-Password', ':=', {1})",
                user.Username, request.Password);
        }

        // Get IP reservation for this user
        var ipReservation = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId == user.Id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

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
            StaticIp = ipReservation?.IpAddress,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            Notes = user.Notes,
            DeviceSerialNumber = user.DeviceSerialNumber,
            GpsLat = user.GpsLat,
            GpsLng = user.GpsLng,
            GroupId = user.GroupId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, response);
    }

    // PUT: api/radius/users/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<RadiusUserResponse>> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id);

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
        // StaticIp is managed via IP Reservations, not updated here
        if (request.Company != null) user.Company = request.Company;
        if (request.Address != null) user.Address = request.Address;
        if (request.ContractId != null) user.ContractId = request.ContractId;
        if (request.Notes != null) user.Notes = request.Notes;
        if (request.DeviceSerialNumber != null) user.DeviceSerialNumber = request.DeviceSerialNumber;
        if (request.GpsLat != null) user.GpsLat = request.GpsLat;
        if (request.GpsLng != null) user.GpsLng = request.GpsLng;
        if (request.SimultaneousSessions.HasValue) user.SimultaneousSessions = request.SimultaneousSessions.Value;
        if (request.ZoneId.HasValue) user.ZoneId = request.ZoneId;
        if (request.GroupId.HasValue) user.GroupId = request.GroupId;

        user.UpdatedAt = DateTime.UtcNow;

        // Update password in radcheck table if provided
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            // Remove existing password entries for this user
            await _context.Database.ExecuteSqlRawAsync(
                "DELETE FROM radcheck WHERE username = {0} AND attribute = 'Cleartext-Password'",
                user.Username);

            // Insert new password
            await _context.Database.ExecuteSqlRawAsync(
                "INSERT INTO radcheck (username, attribute, op, value) VALUES ({0}, 'Cleartext-Password', ':=', {1})",
                user.Username, request.Password);
        }

        await _context.SaveChangesAsync();

        // Get IP reservation for this user
        var updateUserIpReservation = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId == user.Id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

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
            StaticIp = updateUserIpReservation?.IpAddress,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            GroupId = user.GroupId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return Ok(response);
    }

    // DELETE: api/radius/users/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/users/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreUser(int id)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "Deleted user not found" });
        }

        user.IsDeleted = false;
        user.DeletedAt = null;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/users/bulk-delete
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDeleteUsers([FromBody] BulkOperationRequest request)
    {
        if (request.UserIds == null || !request.UserIds.Any())
        {
            return BadRequest(new { message = "No user IDs provided" });
        }

        var users = await _context.RadiusUsers
            .Where(u => request.UserIds.Contains(u.Id) && !u.IsDeleted)
            .ToListAsync();

        if (!users.Any())
        {
            return NotFound(new { message = "No users found to delete" });
        }

        foreach (var user in users)
        {
            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{users.Count} user(s) deleted successfully", count = users.Count });
    }

    // POST: api/radius/users/bulk-restore
    [HttpPost("bulk-restore")]
    public async Task<IActionResult> BulkRestoreUsers([FromBody] BulkOperationRequest request)
    {
        if (request.UserIds == null || !request.UserIds.Any())
        {
            return BadRequest(new { message = "No user IDs provided" });
        }

        var users = await _context.RadiusUsers
            .Where(u => request.UserIds.Contains(u.Id) && u.IsDeleted)
            .ToListAsync();

        if (!users.Any())
        {
            return NotFound(new { message = "No deleted users found to restore" });
        }

        foreach (var user in users)
        {
            user.IsDeleted = false;
            user.DeletedAt = null;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{users.Count} user(s) restored successfully", count = users.Count });
    }

    // POST: api/radius/users/bulk-renew
    [HttpPost("bulk-renew")]
    public async Task<IActionResult> BulkRenewUsers([FromBody] BulkOperationRequest request)
    {
        if (request.UserIds == null || !request.UserIds.Any())
        {
            return BadRequest(new { message = "No user IDs provided" });
        }

        var users = await _context.RadiusUsers
            .Where(u => request.UserIds.Contains(u.Id) && !u.IsDeleted)
            .ToListAsync();

        if (!users.Any())
        {
            return NotFound(new { message = "No users found to renew" });
        }

        foreach (var user in users)
        {
            if (user.Expiration.HasValue)
            {
                user.Expiration = user.Expiration.Value.AddDays(30);
            }
            else
            {
                user.Expiration = DateTime.UtcNow.AddDays(30);
            }
            user.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{users.Count} user(s) renewed successfully", count = users.Count });
    }

    // GET: api/radius/users/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Include(u => u.RadiusGroup)
            .Where(u => u.IsDeleted);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Get IP reservations for users
        var userIds = users.Select(u => u.Id).ToList();
        var ipReservations = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId.HasValue && userIds.Contains(r.RadiusUserId.Value) && r.DeletedAt == null)
            .ToListAsync();
        var userIpMap = ipReservations
            .GroupBy(r => r.RadiusUserId!.Value)
            .ToDictionary(g => g.Key, g => g.First().IpAddress);

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
            StaticIp = userIpMap.ContainsKey(u.Id) ? userIpMap[u.Id] : null,
            DeletedAt = u.DeletedAt,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            ZoneId = u.ZoneId,
            ZoneName = u.Zone != null ? u.Zone.Name : null,
            ZoneColor = u.Zone != null ? u.Zone.Color : null,
            GroupId = u.GroupId,
            GroupName = u.RadiusGroup != null ? u.RadiusGroup.Name : null
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

    // POST: api/radius/users/sync
    [HttpPost("sync")]
    public async Task<ActionResult<SyncUsersResponse>> SyncUsers()
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
                "User sync completed. New: {New}, Updated: {Updated}, Failed: {Failed}",
                response.NewUsers, response.UpdatedUsers, response.FailedUsers
            );

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing users");

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

    // GET: api/radius/users/export/csv
    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportToCsv(
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Where(u => !u.IsDeleted);

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
                "enabled" => isDescending ? query.OrderByDescending(u => u.Enabled) : query.OrderBy(u => u.Enabled),
                "balance" => isDescending ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(u => u.CreatedAt);
        }

        var users = await query.ToListAsync();

        var memoryStream = new MemoryStream();
        var writer = new StreamWriter(memoryStream, new UTF8Encoding(true));
        var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
        });

        // Write headers
        csv.WriteField("Username");
        csv.WriteField("First Name");
        csv.WriteField("Last Name");
        csv.WriteField("Email");
        csv.WriteField("Phone");
        csv.WriteField("City");
        csv.WriteField("Profile");
        csv.WriteField("Status");
        csv.WriteField("Balance");
        csv.WriteField("Loan Balance");
        csv.WriteField("Expiration");
        csv.WriteField("Last Online");
        csv.WriteField("Online Status");
        csv.WriteField("Remaining Days");
        csv.WriteField("Debt Days");
        csv.WriteField("Static IP");
        csv.WriteField("Company");
        csv.WriteField("Address");
        csv.WriteField("Contract ID");
        csv.WriteField("Simultaneous Sessions");
        csv.WriteField("Created At");
        csv.NextRecord();

        // Write data
        foreach (var user in users)
        {
            csv.WriteField(user.Username ?? "");
            csv.WriteField(user.Firstname ?? "");
            csv.WriteField(user.Lastname ?? "");
            csv.WriteField(user.Email ?? "");
            csv.WriteField(user.Phone ?? "");
            csv.WriteField(user.City ?? "");
            csv.WriteField(user.Profile?.Name ?? "");
            csv.WriteField(user.Enabled ? "Enabled" : "Disabled");
            csv.WriteField(user.Balance.ToString("F2"));
            csv.WriteField(user.LoanBalance.ToString("F2"));
            csv.WriteField(user.Expiration?.ToString("yyyy-MM-dd") ?? "");
            csv.WriteField(user.LastOnline?.ToString("yyyy-MM-dd HH:mm:ss") ?? "");
            csv.WriteField(user.OnlineStatus == 1 ? "Online" : "Offline");
            csv.WriteField(user.RemainingDays.ToString());
            csv.WriteField(user.DebtDays.ToString());
            csv.WriteField(user.StaticIp ?? "");
            csv.WriteField(user.Company ?? "");
            csv.WriteField(user.Address ?? "");
            csv.WriteField(user.ContractId ?? "");
            csv.WriteField(user.SimultaneousSessions.ToString());
            csv.WriteField(user.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"));
            csv.NextRecord();
        }

        await csv.FlushAsync();
        await writer.FlushAsync();
        memoryStream.Position = 0;

        var fileName = $"radius_users_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";
        return File(memoryStream, "text/csv", fileName);
    }

    // GET: api/radius/users/export/excel
    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportToExcel(
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Where(u => !u.IsDeleted);

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
                "enabled" => isDescending ? query.OrderByDescending(u => u.Enabled) : query.OrderBy(u => u.Enabled),
                "balance" => isDescending ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(u => u.CreatedAt);
        }

        var users = await query.ToListAsync();

        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add("RADIUS Users");

        // Headers
        worksheet.Cells[1, 1].Value = "Username";
        worksheet.Cells[1, 2].Value = "First Name";
        worksheet.Cells[1, 3].Value = "Last Name";
        worksheet.Cells[1, 4].Value = "Email";
        worksheet.Cells[1, 5].Value = "Phone";
        worksheet.Cells[1, 6].Value = "City";
        worksheet.Cells[1, 7].Value = "Profile";
        worksheet.Cells[1, 8].Value = "Status";
        worksheet.Cells[1, 9].Value = "Balance";
        worksheet.Cells[1, 10].Value = "Loan Balance";
        worksheet.Cells[1, 11].Value = "Expiration";
        worksheet.Cells[1, 12].Value = "Last Online";
        worksheet.Cells[1, 13].Value = "Online Status";
        worksheet.Cells[1, 14].Value = "Remaining Days";
        worksheet.Cells[1, 15].Value = "Debt Days";
        worksheet.Cells[1, 16].Value = "Static IP";
        worksheet.Cells[1, 17].Value = "Company";
        worksheet.Cells[1, 18].Value = "Address";
        worksheet.Cells[1, 19].Value = "Contract ID";
        worksheet.Cells[1, 20].Value = "Simultaneous Sessions";
        worksheet.Cells[1, 21].Value = "Created At";

        // Style headers
        using (var range = worksheet.Cells[1, 1, 1, 21])
        {
            range.Style.Font.Bold = true;
            range.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            range.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightBlue);
            range.Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
        }

        // Data
        int row = 2;
        foreach (var user in users)
        {
            worksheet.Cells[row, 1].Value = user.Username ?? "";
            worksheet.Cells[row, 2].Value = user.Firstname ?? "";
            worksheet.Cells[row, 3].Value = user.Lastname ?? "";
            worksheet.Cells[row, 4].Value = user.Email ?? "";
            worksheet.Cells[row, 5].Value = user.Phone ?? "";
            worksheet.Cells[row, 6].Value = user.City ?? "";
            worksheet.Cells[row, 7].Value = user.Profile?.Name ?? "";
            worksheet.Cells[row, 8].Value = user.Enabled ? "Enabled" : "Disabled";
            worksheet.Cells[row, 9].Value = user.Balance;
            worksheet.Cells[row, 10].Value = user.LoanBalance;
            worksheet.Cells[row, 11].Value = user.Expiration?.ToString("yyyy-MM-dd") ?? "";
            worksheet.Cells[row, 12].Value = user.LastOnline?.ToString("yyyy-MM-dd HH:mm:ss") ?? "";
            worksheet.Cells[row, 13].Value = user.OnlineStatus == 1 ? "Online" : "Offline";
            worksheet.Cells[row, 14].Value = user.RemainingDays;
            worksheet.Cells[row, 15].Value = user.DebtDays;
            worksheet.Cells[row, 16].Value = user.StaticIp ?? "";
            worksheet.Cells[row, 17].Value = user.Company ?? "";
            worksheet.Cells[row, 18].Value = user.Address ?? "";
            worksheet.Cells[row, 19].Value = user.ContractId ?? "";
            worksheet.Cells[row, 20].Value = user.SimultaneousSessions;
            worksheet.Cells[row, 21].Value = user.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
            row++;
        }

        // Auto-fit columns
        worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();

        var fileName = $"radius_users_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
        var fileBytes = package.GetAsByteArray();

        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    // POST: api/radius/users/{id}/tags
    [HttpPost("{id}/tags")]
    public async Task<IActionResult> AssignTags(int id, [FromBody] List<int> tagIds)
    {
        try
        {
            var user = await _context.RadiusUsers
                .Include(u => u.RadiusUserTags)
                .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Remove existing tags
            _context.RadiusUserTags.RemoveRange(user.RadiusUserTags);

            // Add new tags
            foreach (var tagId in tagIds)
            {
                user.RadiusUserTags.Add(new RadiusUserTag
                {
                    RadiusUserId = id,
                    RadiusTagId = tagId,
                    AssignedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Tags updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning tags to user {UserId}", id);
            return StatusCode(500, new { message = "Failed to assign tags" });
        }
    }

    // GET: api/radius/users/{id}/tags
    [HttpGet("{id}/tags")]
    public async Task<ActionResult<IEnumerable<object>>> GetUserTags(int id)
    {
        try
        {
            var tags = await _context.RadiusUserTags
                .Where(rut => rut.RadiusUserId == id)
                .Select(rut => new
                {
                    rut.RadiusTag.Id,
                    rut.RadiusTag.Title,
                    rut.RadiusTag.Description,
                    rut.RadiusTag.Status,
                    rut.RadiusTag.Color,
                    rut.AssignedAt
                })
                .ToListAsync();

            return Ok(tags);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching tags for user {UserId}", id);
            return StatusCode(500, new { message = "Failed to fetch user tags" });
        }
    }

    // POST: api/workspace/{workspaceId}/radius-users/assign-zone
    [HttpPost("assign-zone")]
    public async Task<IActionResult> AssignZoneToUsers(int workspaceId, [FromBody] AssignZoneDto dto)
    {
        try
        {
            var users = await _context.RadiusUsers
                .Where(u => dto.UserIds.Contains(u.Id) && !u.IsDeleted)
                .ToListAsync();

            if (users.Count == 0)
            {
                return NotFound(new { message = "No valid users found" });
            }

            foreach (var user in users)
            {
                user.ZoneId = dto.ZoneId;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Zone assigned successfully", count = users.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning zone to users");
            return StatusCode(500, new { message = "Failed to assign zone" });
        }
    }
}

public class AssignZoneDto
{
    public List<int> UserIds { get; set; } = new();
    public int? ZoneId { get; set; }
}
