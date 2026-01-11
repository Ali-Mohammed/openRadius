using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/radius/tags")]
    public class RadiusTagController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly MasterDbContext _masterContext;
        private readonly ILogger<RadiusTagController> _logger;

        public RadiusTagController(ApplicationDbContext context, MasterDbContext masterContext, ILogger<RadiusTagController> logger)
        {
            _context = context;
            _masterContext = masterContext;
            _logger = logger;
        }

        private async Task<int?> GetCurrentWorkspaceIdAsync()
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail)) return null;
            
            var user = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            return user?.CurrentWorkspaceId;
        }

        // GET: api/radius/tags
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetTags([FromQuery] bool includeDeleted = false)
        {
            try
            {
                var workspaceId = await GetCurrentWorkspaceIdAsync();
                if (workspaceId == null)
                {
                    return Unauthorized(new { message = "User workspace not found" });
                }

                var query = _context.RadiusTags.AsQueryable();

                if (!includeDeleted)
                {
                    query = query.Where(t => t.DeletedAt == null);
                }

                var tags = await query
                    .OrderByDescending(t => t.CreatedAt)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Description,
                        t.Status,
                        t.Color,
                        t.Icon,
                        t.CreatedAt,
                        t.UpdatedAt,
                        t.DeletedAt,
                        IsDeleted = t.DeletedAt != null,
                        UsersCount = t.RadiusUserTags.Count(rut => rut.RadiusUser.DeletedAt == null)
                    })
                    .ToListAsync();

                return Ok(tags);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching RADIUS tags");
                return StatusCode(500, new { message = "Failed to fetch tags" });
            }
        }

        // GET: api/radius/tags/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetTag(int id)
        {
            try
            {
                var tag = await _context.RadiusTags
                    .Where(t => t.Id == id)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Description,
                        t.Status,
                        t.Color,
                        t.Icon,
                        t.CreatedAt,
                        t.UpdatedAt,
                        t.DeletedAt,
                        UsersCount = t.RadiusUserTags.Count(rut => rut.RadiusUser.DeletedAt == null)
                    })
                    .FirstOrDefaultAsync();

                if (tag == null)
                {
                    return NotFound(new { message = "Tag not found" });
                }

                return Ok(tag);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching tag {TagId}", id);
                return StatusCode(500, new { message = "Failed to fetch tag" });
            }
        }

        // POST: api/radius/tags
        [HttpPost]
        public async Task<ActionResult<object>> CreateTag([FromBody] CreateRadiusTagRequest request)
        {
            try
            {
                var workspaceId = await GetCurrentWorkspaceIdAsync();
                if (workspaceId == null)
                {
                    return Unauthorized(new { message = "User workspace not found" });
                }

                // Check if tag with same title exists
                var exists = await _context.RadiusTags.AnyAsync(t => t.Title == request.Title && t.DeletedAt == null);
                if (exists)
                {
                    return BadRequest(new { message = "A tag with this title already exists" });
                }

                var tag = new RadiusTag
                {
                    Title = request.Title,
                    Description = request.Description,
                    Status = request.Status ?? "active",
                    Color = request.Color ?? "#3b82f6",
                    Icon = request.Icon ?? "Tag",
                    CreatedAt = DateTime.UtcNow
                };

                _context.RadiusTags.Add(tag);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetTag), new { id = tag.Id }, new
                {
                    tag.Id,
                    tag.Title,
                    tag.Description,
                    tag.Status,
                    tag.Color,
                    tag.Icon,
                    tag.CreatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tag");
                return StatusCode(500, new { message = "Failed to create tag" });
            }
        }

        // PUT: api/radius/tags/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTag(int id, [FromBody] UpdateRadiusTagRequest request)
        {
            try
            {
                var tag = await _context.RadiusTags.FindAsync(id);
                if (tag == null || tag.DeletedAt != null)
                {
                    return NotFound(new { message = "Tag not found" });
                }

                // Check if another tag with the same title exists
                if (request.Title != null && request.Title != tag.Title)
                {
                    var exists = await _context.RadiusTags.AnyAsync(t => t.Title == request.Title && t.Id != id && t.DeletedAt == null);
                    if (exists)
                    {
                        return BadRequest(new { message = "A tag with this title already exists" });
                    }
                    tag.Title = request.Title;
                }

                if (request.Description != null)
                    tag.Description = request.Description;
                
                if (request.Status != null)
                    tag.Status = request.Status;
                
                if (request.Color != null)
                    tag.Color = request.Color;
                
                if (request.Icon != null)
                    tag.Icon = request.Icon;

                tag.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { message = "Tag updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating tag {TagId}", id);
                return StatusCode(500, new { message = "Failed to update tag" });
            }
        }

        // DELETE: api/radius/tags/{id} (Soft delete)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTag(int id)
        {
            try
            {
                var tag = await _context.RadiusTags.FindAsync(id);
                if (tag == null)
                {
                    return NotFound(new { message = "Tag not found" });
                }

                tag.DeletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { message = "Tag deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tag {TagId}", id);
                return StatusCode(500, new { message = "Failed to delete tag" });
            }
        }

        // POST: api/radius/tags/{id}/restore
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreTag(int id)
        {
            try
            {
                var tag = await _context.RadiusTags.FindAsync(id);
                if (tag == null)
                {
                    return NotFound(new { message = "Tag not found" });
                }

                tag.DeletedAt = null;
                tag.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { message = "Tag restored successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring tag {TagId}", id);
                return StatusCode(500, new { message = "Failed to restore tag" });
            }
        }

        // GET: api/radius/tags/{id}/users
        [HttpGet("{id}/users")]
        public async Task<ActionResult<IEnumerable<object>>> GetTagUsers(int id)
        {
            try
            {
                var users = await _context.RadiusUserTags
                    .Where(rut => rut.RadiusTagId == id && rut.RadiusUser.DeletedAt == null)
                    .Select(rut => new
                    {
                        rut.RadiusUser.Id,
                        rut.RadiusUser.Username,
                        rut.RadiusUser.Firstname,
                        rut.RadiusUser.Lastname,
                        rut.RadiusUser.Email,
                        rut.AssignedAt
                    })
                    .ToListAsync();

                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching users for tag {TagId}", id);
                return StatusCode(500, new { message = "Failed to fetch tag users" });
            }
        }
    }

    public class CreateRadiusTagRequest
    {
        public required string Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public string? Color { get; set; }
        public string? Icon { get; set; }
    }

    public class UpdateRadiusTagRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public string? Color { get; set; }
        public string? Icon { get; set; }
    }
}
