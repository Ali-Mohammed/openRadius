using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;
using System.Security.Claims;

namespace Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SubAgentCashbackController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<SubAgentCashbackController> _logger;

    public SubAgentCashbackController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        ILogger<SubAgentCashbackController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _logger = logger;
    }

    /// <summary>
    /// Get all sub-agent cashback configurations for the current supervisor
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetSubAgentCashbacks()
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User email not found in token" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            var cashbacks = await _context.SubAgentCashbacks
                .Where(sac => sac.SupervisorId == currentUser.Id && sac.DeletedAt == null)
                .OrderByDescending(sac => sac.CreatedAt)
                .Select(sac => new
                {
                    sac.Id,
                    sac.SupervisorId,
                    sac.SubAgentId,
                    sac.BillingProfileId,
                    BillingProfileName = sac.BillingProfile != null ? sac.BillingProfile.Name : null,
                    sac.Amount,
                    sac.Notes,
                    sac.CreatedAt,
                    sac.UpdatedAt
                })
                .ToListAsync();

            // Get sub-agent details from master database
            var subAgentIds = cashbacks.Select(c => c.SubAgentId).Distinct().ToList();
            var subAgents = await _masterContext.Users
                .Where(u => subAgentIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.Username })
                .ToListAsync();

            var result = cashbacks.Select(c =>
            {
                var subAgent = subAgents.FirstOrDefault(sa => sa.Id == c.SubAgentId);
                return new
                {
                    c.Id,
                    c.SupervisorId,
                    c.SubAgentId,
                    SubAgentEmail = subAgent?.Email,
                    SubAgentName = subAgent != null ? $"{subAgent.FirstName} {subAgent.LastName}".Trim() : null,
                    SubAgentUsername = subAgent?.Username,
                    c.BillingProfileId,
                    c.BillingProfileName,
                    c.Amount,
                    c.Notes,
                    c.CreatedAt,
                    c.UpdatedAt
                };
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving sub-agent cashbacks");
            return StatusCode(500, new { error = "An error occurred while retrieving sub-agent cashbacks" });
        }
    }

    /// <summary>
    /// Get sub-agents for the current supervisor
    /// </summary>
    [HttpGet("sub-agents")]
    public async Task<ActionResult<IEnumerable<object>>> GetSubAgents()
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User email not found in token" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            // Get all sub-agents where current user is the supervisor
            var subAgents = await _masterContext.Users
                .Where(u => u.SupervisorId == currentUser.Id && u.DisabledAt == null)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FirstName,
                    u.LastName,
                    u.Username,
                    Name = (u.FirstName + " " + u.LastName).Trim()
                })
                .ToListAsync();

            return Ok(subAgents);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving sub-agents");
            return StatusCode(500, new { error = "An error occurred while retrieving sub-agents" });
        }
    }

    /// <summary>
    /// Get cashback configurations for a specific sub-agent
    /// </summary>
    [HttpGet("sub-agent/{subAgentId}")]
    public async Task<ActionResult<IEnumerable<object>>> GetSubAgentCashbacksBySubAgent(int subAgentId)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User email not found in token" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            // Verify the sub-agent belongs to this supervisor
            var subAgent = await _masterContext.Users.FirstOrDefaultAsync(u => u.Id == subAgentId);
            if (subAgent == null || subAgent.SupervisorId != currentUser.Id)
            {
                return Forbid();
            }

            var cashbacks = await _context.SubAgentCashbacks
                .Where(sac => sac.SupervisorId == currentUser.Id && sac.SubAgentId == subAgentId && sac.DeletedAt == null)
                .Select(sac => new
                {
                    sac.Id,
                    sac.BillingProfileId,
                    BillingProfileName = sac.BillingProfile != null ? sac.BillingProfile.Name : null,
                    sac.Amount,
                    sac.Notes,
                    sac.CreatedAt,
                    sac.UpdatedAt
                })
                .ToListAsync();

            return Ok(cashbacks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cashbacks for sub-agent {SubAgentId}", subAgentId);
            return StatusCode(500, new { error = "An error occurred while retrieving cashbacks" });
        }
    }

    /// <summary>
    /// Create or update sub-agent cashback
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<object>> CreateOrUpdateSubAgentCashback([FromBody] SubAgentCashbackRequest request)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User email not found in token" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            // Verify the sub-agent belongs to this supervisor
            var subAgent = await _masterContext.Users.FirstOrDefaultAsync(u => u.Id == request.SubAgentId);
            if (subAgent == null || subAgent.SupervisorId != currentUser.Id)
            {
                return BadRequest(new { error = "Invalid sub-agent or you don't have permission to set cashback for this user" });
            }

            // Verify billing profile exists
            var billingProfile = await _context.BillingProfiles.FindAsync(request.BillingProfileId);
            if (billingProfile == null)
            {
                return NotFound(new { error = "Billing profile not found" });
            }

            // Check if cashback already exists
            var existing = await _context.SubAgentCashbacks
                .FirstOrDefaultAsync(sac =>
                    sac.SupervisorId == currentUser.Id &&
                    sac.SubAgentId == request.SubAgentId &&
                    sac.BillingProfileId == request.BillingProfileId &&
                    sac.DeletedAt == null);

            if (existing != null)
            {
                // Update existing
                existing.Amount = request.Amount;
                existing.Notes = request.Notes;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.UpdatedBy = User.GetSystemUserId() ?? currentUser.Id;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Updated sub-agent cashback {existing.Id} for sub-agent {request.SubAgentId}");

                return Ok(new
                {
                    existing.Id,
                    existing.SupervisorId,
                    existing.SubAgentId,
                    existing.BillingProfileId,
                    BillingProfileName = billingProfile.Name,
                    existing.Amount,
                    existing.Notes,
                    existing.CreatedAt,
                    existing.UpdatedAt
                });
            }
            else
            {
                // Create new
                var cashback = new SubAgentCashback
                {
                    SupervisorId = currentUser.Id,
                    SubAgentId = request.SubAgentId,
                    BillingProfileId = request.BillingProfileId,
                    Amount = request.Amount,
                    Notes = request.Notes,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = User.GetSystemUserId() ?? currentUser.Id
                };

                _context.SubAgentCashbacks.Add(cashback);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Created sub-agent cashback {cashback.Id} for sub-agent {request.SubAgentId}");

                return CreatedAtAction(nameof(GetSubAgentCashbacks), new { id = cashback.Id }, new
                {
                    cashback.Id,
                    cashback.SupervisorId,
                    cashback.SubAgentId,
                    cashback.BillingProfileId,
                    BillingProfileName = billingProfile.Name,
                    cashback.Amount,
                    cashback.Notes,
                    cashback.CreatedAt,
                    cashback.UpdatedAt
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating/updating sub-agent cashback");
            return StatusCode(500, new { error = "An error occurred while saving sub-agent cashback" });
        }
    }

    /// <summary>
    /// Delete sub-agent cashback (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSubAgentCashback(int id)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User email not found in token" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            var cashback = await _context.SubAgentCashbacks.FindAsync(id);
            if (cashback == null || cashback.DeletedAt != null)
            {
                return NotFound(new { error = "Sub-agent cashback not found" });
            }

            // Verify ownership
            if (cashback.SupervisorId != currentUser.Id)
            {
                return Forbid();
            }

            // Soft delete
            cashback.DeletedAt = DateTime.UtcNow;
            cashback.DeletedBy = User.GetSystemUserId() ?? currentUser.Id;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Deleted sub-agent cashback {id}");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting sub-agent cashback {Id}", id);
            return StatusCode(500, new { error = "An error occurred while deleting sub-agent cashback" });
        }
    }

    /// <summary>
    /// Bulk update cashback amounts for a sub-agent across multiple billing profiles
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<object>> BulkUpdateSubAgentCashback([FromBody] BulkSubAgentCashbackRequest request)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User email not found in token" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            // Verify the sub-agent belongs to this supervisor
            var subAgent = await _masterContext.Users.FirstOrDefaultAsync(u => u.Id == request.SubAgentId);
            if (subAgent == null || subAgent.SupervisorId != currentUser.Id)
            {
                return BadRequest(new { error = "Invalid sub-agent or you don't have permission" });
            }

            var created = 0;
            var updated = 0;

            foreach (var item in request.Cashbacks)
            {
                var existing = await _context.SubAgentCashbacks
                    .FirstOrDefaultAsync(sac =>
                        sac.SupervisorId == currentUser.Id &&
                        sac.SubAgentId == request.SubAgentId &&
                        sac.BillingProfileId == item.BillingProfileId &&
                        sac.DeletedAt == null);

                if (existing != null)
                {
                    existing.Amount = item.Amount;
                    existing.UpdatedAt = DateTime.UtcNow;
                    existing.UpdatedBy = User.GetSystemUserId() ?? currentUser.Id;
                    updated++;
                }
                else
                {
                    var cashback = new SubAgentCashback
                    {
                        SupervisorId = currentUser.Id,
                        SubAgentId = request.SubAgentId,
                        BillingProfileId = item.BillingProfileId,
                        Amount = item.Amount,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId() ?? currentUser.Id
                    };
                    _context.SubAgentCashbacks.Add(cashback);
                    created++;
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Bulk update: created {created}, updated {updated} sub-agent cashbacks");

            return Ok(new { created, updated });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in bulk update sub-agent cashback");
            return StatusCode(500, new { error = "An error occurred while bulk updating sub-agent cashback" });
        }
    }
}

public class SubAgentCashbackRequest
{
    public int SubAgentId { get; set; }
    public int BillingProfileId { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
}

public class BulkSubAgentCashbackRequest
{
    public int SubAgentId { get; set; }
    public List<BulkCashbackItem> Cashbacks { get; set; } = new();
}

public class BulkCashbackItem
{
    public int BillingProfileId { get; set; }
    public decimal Amount { get; set; }
}
