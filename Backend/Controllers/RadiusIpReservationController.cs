using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/ip-reservations")]
public class RadiusIpReservationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusIpReservationController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public RadiusIpReservationController(
        ApplicationDbContext context, 
        ILogger<RadiusIpReservationController> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // GET: api/radius/ip-reservations
    [HttpGet]
    public async Task<ActionResult<object>> GetIpReservations(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool onlyDeleted = false)
    {
        var query = _context.RadiusIpReservations
            .Include(r => r.RadiusUser)
                .ThenInclude(u => u!.Profile)
            .Include(r => r.RadiusUser)
                .ThenInclude(u => u!.Zone)
            .Include(r => r.RadiusUser)
                .ThenInclude(u => u!.RadiusGroup)
            .Where(r => onlyDeleted ? r.DeletedAt != null : r.DeletedAt == null);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(r => 
                (r.IpAddress != null && r.IpAddress.ToLower().Contains(searchLower)) ||
                (r.Description != null && r.Description.ToLower().Contains(searchLower)) ||
                (r.RadiusUser != null && r.RadiusUser.Username != null && r.RadiusUser.Username.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "ipaddress" => isDescending ? query.OrderByDescending(r => r.IpAddress) : query.OrderBy(r => r.IpAddress),
                "description" => isDescending ? query.OrderByDescending(r => r.Description) : query.OrderBy(r => r.Description),
                "username" => isDescending ? query.OrderByDescending(r => r.RadiusUser!.Username) : query.OrderBy(r => r.RadiusUser!.Username),
                "createdat" => isDescending ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt),
                "updatedat" => isDescending ? query.OrderByDescending(r => r.UpdatedAt) : query.OrderBy(r => r.UpdatedAt),
                _ => query.OrderByDescending(r => r.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(r => r.CreatedAt);
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var reservations = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RadiusIpReservationResponse
            {
                Id = r.Id,
                IpAddress = r.IpAddress,
                Description = r.Description,
                RadiusUserId = r.RadiusUserId,
                Username = r.RadiusUser != null ? r.RadiusUser.Username : null,
                Firstname = r.RadiusUser != null ? r.RadiusUser.Firstname : null,
                Lastname = r.RadiusUser != null ? r.RadiusUser.Lastname : null,
                ProfileName = r.RadiusUser != null && r.RadiusUser.Profile != null ? r.RadiusUser.Profile.Name : null,
                ZoneName = r.RadiusUser != null && r.RadiusUser.Zone != null ? r.RadiusUser.Zone.Name : null,
                GroupName = r.RadiusUser != null && r.RadiusUser.RadiusGroup != null ? r.RadiusUser.RadiusGroup.Name : null,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt,
                DeletedAt = r.DeletedAt,
                DeletedBy = r.DeletedBy
            })
            .ToListAsync();

        return Ok(new
        {
            data = reservations,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalPages = totalPages,
                totalRecords = totalRecords,
                hasNextPage = page < totalPages,
                hasPreviousPage = page > 1
            }
        });
    }

    // GET: api/radius/ip-reservations/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusIpReservationResponse>> GetIpReservation(int id)
    {
        var reservation = await _context.RadiusIpReservations
            .Include(r => r.RadiusUser)
            .Where(r => r.Id == id)
            .Select(r => new RadiusIpReservationResponse
            {
                Id = r.Id,
                IpAddress = r.IpAddress,
                Description = r.Description,
                RadiusUserId = r.RadiusUserId,
                Username = r.RadiusUser != null ? r.RadiusUser.Username : null,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt,
                DeletedAt = r.DeletedAt,
                DeletedBy = r.DeletedBy
            })
            .FirstOrDefaultAsync();

        if (reservation == null)
        {
            return NotFound();
        }

        return Ok(reservation);
    }

    // POST: api/radius/ip-reservations
    [HttpPost]
    public async Task<ActionResult<RadiusIpReservationResponse>> CreateIpReservation(RadiusIpReservation reservation)
    {
        // Validate IP address format
        if (!System.Net.IPAddress.TryParse(reservation.IpAddress, out _))
        {
            return BadRequest(new { message = "Invalid IP address format" });
        }

        // Check if IP already exists and not deleted
        var existingIp = await _context.RadiusIpReservations
            .Where(r => r.IpAddress == reservation.IpAddress && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (existingIp != null)
        {
            return BadRequest(new { message = "IP address already reserved" });
        }

        // Check if user already has an IP reservation
        if (reservation.RadiusUserId.HasValue)
        {
            var existingUserReservation = await _context.RadiusIpReservations
                .Where(r => r.RadiusUserId == reservation.RadiusUserId && r.DeletedAt == null)
                .FirstOrDefaultAsync();

            if (existingUserReservation != null)
            {
                return BadRequest(new { message = "This user already has an IP reservation" });
            }
        }

        reservation.CreatedAt = DateTime.UtcNow;
        _context.RadiusIpReservations.Add(reservation);
        await _context.SaveChangesAsync();

        var response = await _context.RadiusIpReservations
            .Include(r => r.RadiusUser)
            .Where(r => r.Id == reservation.Id)
            .Select(r => new RadiusIpReservationResponse
            {
                Id = r.Id,
                IpAddress = r.IpAddress,
                Description = r.Description,
                RadiusUserId = r.RadiusUserId,
                Username = r.RadiusUser != null ? r.RadiusUser.Username : null,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt,
                DeletedAt = r.DeletedAt,
                DeletedBy = r.DeletedBy
            })
            .FirstOrDefaultAsync();

        return CreatedAtAction(nameof(GetIpReservation), new { id = reservation.Id }, response);
    }

    // PUT: api/radius/ip-reservations/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIpReservation(int id, RadiusIpReservation reservation)
    {
        if (id != reservation.Id)
        {
            return BadRequest();
        }

        var existingReservation = await _context.RadiusIpReservations.FindAsync(id);
        if (existingReservation == null)
        {
            return NotFound();
        }

        // Validate IP address format
        if (!System.Net.IPAddress.TryParse(reservation.IpAddress, out _))
        {
            return BadRequest(new { message = "Invalid IP address format" });
        }

        // Check if IP already exists for another reservation
        var duplicateIp = await _context.RadiusIpReservations
            .Where(r => r.IpAddress == reservation.IpAddress && r.Id != id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (duplicateIp != null)
        {
            return BadRequest(new { message = "IP address already reserved by another entry" });
        }

        // Check if user already has an IP reservation (excluding current reservation)
        if (reservation.RadiusUserId.HasValue)
        {
            var duplicateUser = await _context.RadiusIpReservations
                .Where(r => r.RadiusUserId == reservation.RadiusUserId && r.Id != id && r.DeletedAt == null)
                .FirstOrDefaultAsync();

            if (duplicateUser != null)
            {
                return BadRequest(new { message = "This user already has an IP reservation" });
            }
        }

        existingReservation.IpAddress = reservation.IpAddress;
        existingReservation.Description = reservation.Description;
        existingReservation.RadiusUserId = reservation.RadiusUserId;
        existingReservation.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await IpReservationExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    // DELETE: api/radius/ip-reservations/{id} (Soft delete)
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIpReservation(int id)
    {
        var reservation = await _context.RadiusIpReservations.FindAsync(id);
        if (reservation == null)
        {
            return NotFound();
        }

        // Get current user email from claims
        var userEmail = _httpContextAccessor.HttpContext?.User?.FindFirst("preferred_username")?.Value 
                       ?? _httpContextAccessor.HttpContext?.User?.FindFirst("email")?.Value 
                       ?? "system";

        reservation.DeletedAt = DateTime.UtcNow;
        reservation.DeletedBy = userEmail;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/ip-reservations/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreIpReservation(int id)
    {
        var reservation = await _context.RadiusIpReservations.FindAsync(id);
        if (reservation == null)
        {
            return NotFound();
        }

        // Check if IP already exists and not deleted
        var existingIp = await _context.RadiusIpReservations
            .Where(r => r.IpAddress == reservation.IpAddress && r.Id != id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (existingIp != null)
        {
            return BadRequest(new { message = "IP address already reserved by another active entry" });
        }

        reservation.DeletedAt = null;
        reservation.DeletedBy = null;
        reservation.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/ip-reservations/bulk-delete (Bulk soft delete)
    [HttpPost("bulk-delete")]
    public async Task<ActionResult<object>> BulkDeleteIpReservations([FromBody] List<int> ids)
    {
        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        var reservations = await _context.RadiusIpReservations
            .Where(r => ids.Contains(r.Id) && r.DeletedAt == null)
            .ToListAsync();

        if (reservations.Count == 0)
        {
            return NotFound(new { message = "No active reservations found with the provided IDs" });
        }

        // Get current user email from claims
        var userEmail = _httpContextAccessor.HttpContext?.User?.FindFirst("preferred_username")?.Value 
                       ?? _httpContextAccessor.HttpContext?.User?.FindFirst("email")?.Value 
                       ?? "system";

        foreach (var reservation in reservations)
        {
            reservation.DeletedAt = DateTime.UtcNow;
            reservation.DeletedBy = userEmail;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Successfully deleted {reservations.Count} IP reservation(s)",
            count = reservations.Count
        });
    }

    // POST: api/radius/ip-reservations/bulk-restore (Bulk restore)
    [HttpPost("bulk-restore")]
    public async Task<ActionResult<object>> BulkRestoreIpReservations([FromBody] List<int> ids)
    {
        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new { message = "No IDs provided" });
        }

        var reservations = await _context.RadiusIpReservations
            .Where(r => ids.Contains(r.Id) && r.DeletedAt != null)
            .ToListAsync();

        if (reservations.Count == 0)
        {
            return NotFound(new { message = "No deleted reservations found with the provided IDs" });
        }

        foreach (var reservation in reservations)
        {
            // Check if IP already exists and not deleted
            var existingIp = await _context.RadiusIpReservations
                .Where(r => r.IpAddress == reservation.IpAddress && r.Id != reservation.Id && r.DeletedAt == null)
                .FirstOrDefaultAsync();

            if (existingIp != null)
            {
                return BadRequest(new { message = $"IP address {reservation.IpAddress} is already reserved by another active entry" });
            }

            reservation.DeletedAt = null;
            reservation.DeletedBy = null;
            reservation.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Successfully restored {reservations.Count} IP reservation(s)",
            count = reservations.Count
        });
    }

    private async Task<bool> IpReservationExists(int id)
    {
        return await _context.RadiusIpReservations.AnyAsync(e => e.Id == id);
    }
}
