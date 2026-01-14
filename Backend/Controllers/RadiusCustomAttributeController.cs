using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/custom-attributes")]
public class RadiusCustomAttributeController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusCustomAttributeController> _logger;

    public RadiusCustomAttributeController(ApplicationDbContext context, ILogger<RadiusCustomAttributeController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/radius/custom-attributes
    [HttpGet]
    public async Task<ActionResult<object>> GetCustomAttributes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? linkType = null,
        [FromQuery] int? radiusUserId = null,
        [FromQuery] int? radiusProfileId = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var query = _context.RadiusCustomAttributes
            .Include(a => a.RadiusUser)
            .Include(a => a.RadiusProfile)
            .Where(a => includeDeleted || !a.IsDeleted);

        // Apply filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(a =>
                a.AttributeName.ToLower().Contains(searchLower) ||
                a.AttributeValue.ToLower().Contains(searchLower)
            );
        }

        if (!string.IsNullOrWhiteSpace(linkType))
        {
            query = query.Where(a => a.LinkType == linkType);
        }

        if (radiusUserId.HasValue)
        {
            query = query.Where(a => a.RadiusUserId == radiusUserId.Value);
        }

        if (radiusProfileId.HasValue)
        {
            query = query.Where(a => a.RadiusProfileId == radiusProfileId.Value);
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "attributename" => isDescending ? query.OrderByDescending(a => a.AttributeName) : query.OrderBy(a => a.AttributeName),
                "attributevalue" => isDescending ? query.OrderByDescending(a => a.AttributeValue) : query.OrderBy(a => a.AttributeValue),
                "linktype" => isDescending ? query.OrderByDescending(a => a.LinkType) : query.OrderBy(a => a.LinkType),
                "enabled" => isDescending ? query.OrderByDescending(a => a.Enabled) : query.OrderBy(a => a.Enabled),
                "createdat" => isDescending ? query.OrderByDescending(a => a.CreatedAt) : query.OrderBy(a => a.CreatedAt),
                _ => query.OrderByDescending(a => a.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(a => a.CreatedAt);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = items.Select(a => new RadiusCustomAttributeResponse
        {
            Id = a.Id,
            AttributeName = a.AttributeName,
            AttributeValue = a.AttributeValue,
            LinkType = a.LinkType,
            RadiusUserId = a.RadiusUserId,
            RadiusUsername = a.RadiusUser?.Username,
            RadiusProfileId = a.RadiusProfileId,
            RadiusProfileName = a.RadiusProfile?.Name,
            Enabled = a.Enabled,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt
        }).ToList();

        return Ok(new
        {
            data = response,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            }
        });
    }

    // GET: api/radius/custom-attributes/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusCustomAttributeResponse>> GetCustomAttribute(int id)
    {
        var attribute = await _context.RadiusCustomAttributes
            .Include(a => a.RadiusUser)
            .Include(a => a.RadiusProfile)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (attribute == null)
        {
            return NotFound(new { message = "Custom attribute not found" });
        }

        var response = new RadiusCustomAttributeResponse
        {
            Id = attribute.Id,
            AttributeName = attribute.AttributeName,
            AttributeValue = attribute.AttributeValue,
            LinkType = attribute.LinkType,
            RadiusUserId = attribute.RadiusUserId,
            RadiusUsername = attribute.RadiusUser?.Username,
            RadiusProfileId = attribute.RadiusProfileId,
            RadiusProfileName = attribute.RadiusProfile?.Name,
            Enabled = attribute.Enabled,
            CreatedAt = attribute.CreatedAt,
            UpdatedAt = attribute.UpdatedAt
        };

        return Ok(response);
    }

    // POST: api/radius/custom-attributes
    [HttpPost]
    public async Task<ActionResult<RadiusCustomAttributeResponse>> CreateCustomAttribute([FromBody] CreateRadiusCustomAttributeRequest request)
    {
        // Validate link type
        if (request.LinkType != "user" && request.LinkType != "profile")
        {
            return BadRequest(new { message = "LinkType must be either 'user' or 'profile'" });
        }

        // Validate that the appropriate foreign key is provided
        if (request.LinkType == "user" && !request.RadiusUserId.HasValue)
        {
            return BadRequest(new { message = "RadiusUserId is required when LinkType is 'user'" });
        }

        if (request.LinkType == "profile" && !request.RadiusProfileId.HasValue)
        {
            return BadRequest(new { message = "RadiusProfileId is required when LinkType is 'profile'" });
        }

        // Verify the linked entity exists
        if (request.LinkType == "user")
        {
            var userExists = await _context.RadiusUsers.AnyAsync(u => u.Id == request.RadiusUserId && !u.IsDeleted);
            if (!userExists)
            {
                return NotFound(new { message = "Radius user not found" });
            }
        }
        else if (request.LinkType == "profile")
        {
            var profileExists = await _context.RadiusProfiles.AnyAsync(p => p.Id == request.RadiusProfileId && !p.IsDeleted);
            if (!profileExists)
            {
                return NotFound(new { message = "Radius profile not found" });
            }
        }

        var attribute = new RadiusCustomAttribute
        {
            AttributeName = request.AttributeName,
            AttributeValue = request.AttributeValue,
            LinkType = request.LinkType,
            RadiusUserId = request.LinkType == "user" ? request.RadiusUserId : null,
            RadiusProfileId = request.LinkType == "profile" ? request.RadiusProfileId : null,
            Enabled = request.Enabled,
            WorkspaceId = 1, // Will be set by multi-tenant context
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.RadiusCustomAttributes.Add(attribute);
        await _context.SaveChangesAsync();

        // Reload with includes
        var created = await _context.RadiusCustomAttributes
            .Include(a => a.RadiusUser)
            .Include(a => a.RadiusProfile)
            .FirstOrDefaultAsync(a => a.Id == attribute.Id);

        var response = new RadiusCustomAttributeResponse
        {
            Id = created!.Id,
            AttributeName = created.AttributeName,
            AttributeValue = created.AttributeValue,
            LinkType = created.LinkType,
            RadiusUserId = created.RadiusUserId,
            RadiusUsername = created.RadiusUser?.Username,
            RadiusProfileId = created.RadiusProfileId,
            RadiusProfileName = created.RadiusProfile?.Name,
            Enabled = created.Enabled,
            CreatedAt = created.CreatedAt,
            UpdatedAt = created.UpdatedAt
        };

        return CreatedAtAction(nameof(GetCustomAttribute), new { id = attribute.Id }, response);
    }

    // PUT: api/radius/custom-attributes/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<RadiusCustomAttributeResponse>> UpdateCustomAttribute(int id, [FromBody] UpdateRadiusCustomAttributeRequest request)
    {
        var attribute = await _context.RadiusCustomAttributes.FindAsync(id);

        if (attribute == null || attribute.IsDeleted)
        {
            return NotFound(new { message = "Custom attribute not found" });
        }

        // Update fields if provided
        if (!string.IsNullOrWhiteSpace(request.AttributeName))
            attribute.AttributeName = request.AttributeName;

        if (!string.IsNullOrWhiteSpace(request.AttributeValue))
            attribute.AttributeValue = request.AttributeValue;

        if (!string.IsNullOrWhiteSpace(request.LinkType))
        {
            if (request.LinkType != "user" && request.LinkType != "profile")
            {
                return BadRequest(new { message = "LinkType must be either 'user' or 'profile'" });
            }

            attribute.LinkType = request.LinkType;

            // Clear the foreign keys and set the appropriate one
            attribute.RadiusUserId = null;
            attribute.RadiusProfileId = null;

            if (request.LinkType == "user" && request.RadiusUserId.HasValue)
            {
                var userExists = await _context.RadiusUsers.AnyAsync(u => u.Id == request.RadiusUserId && !u.IsDeleted);
                if (!userExists)
                {
                    return NotFound(new { message = "Radius user not found" });
                }
                attribute.RadiusUserId = request.RadiusUserId;
            }
            else if (request.LinkType == "profile" && request.RadiusProfileId.HasValue)
            {
                var profileExists = await _context.RadiusProfiles.AnyAsync(p => p.Id == request.RadiusProfileId && !p.IsDeleted);
                if (!profileExists)
                {
                    return NotFound(new { message = "Radius profile not found" });
                }
                attribute.RadiusProfileId = request.RadiusProfileId;
            }
        }

        if (request.Enabled.HasValue)
            attribute.Enabled = request.Enabled.Value;

        attribute.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Reload with includes
        var updated = await _context.RadiusCustomAttributes
            .Include(a => a.RadiusUser)
            .Include(a => a.RadiusProfile)
            .FirstOrDefaultAsync(a => a.Id == id);

        var response = new RadiusCustomAttributeResponse
        {
            Id = updated!.Id,
            AttributeName = updated.AttributeName,
            AttributeValue = updated.AttributeValue,
            LinkType = updated.LinkType,
            RadiusUserId = updated.RadiusUserId,
            RadiusUsername = updated.RadiusUser?.Username,
            RadiusProfileId = updated.RadiusProfileId,
            RadiusProfileName = updated.RadiusProfile?.Name,
            Enabled = updated.Enabled,
            CreatedAt = updated.CreatedAt,
            UpdatedAt = updated.UpdatedAt
        };

        return Ok(response);
    }

    // DELETE: api/radius/custom-attributes/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCustomAttribute(int id)
    {
        var attribute = await _context.RadiusCustomAttributes.FindAsync(id);

        if (attribute == null || attribute.IsDeleted)
        {
            return NotFound(new { message = "Custom attribute not found" });
        }

        // Soft delete
        attribute.IsDeleted = true;
        attribute.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/custom-attributes/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreCustomAttribute(int id)
    {
        var attribute = await _context.RadiusCustomAttributes.FindAsync(id);

        if (attribute == null)
        {
            return NotFound(new { message = "Custom attribute not found" });
        }

        if (!attribute.IsDeleted)
        {
            return BadRequest(new { message = "Custom attribute is not deleted" });
        }

        attribute.IsDeleted = false;
        attribute.DeletedAt = null;
        attribute.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // DELETE: api/radius/custom-attributes/bulk
    [HttpDelete("bulk")]
    public async Task<IActionResult> BulkDeleteCustomAttributes([FromBody] int[] ids)
    {
        var attributes = await _context.RadiusCustomAttributes
            .Where(a => ids.Contains(a.Id) && !a.IsDeleted)
            .ToListAsync();

        if (!attributes.Any())
        {
            return NotFound(new { message = "No custom attributes found" });
        }

        foreach (var attribute in attributes)
        {
            attribute.IsDeleted = true;
            attribute.DeletedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{attributes.Count} custom attributes deleted" });
    }
}
