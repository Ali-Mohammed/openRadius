using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UserCashbackController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly MasterDbContext _masterContext;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<UserCashbackController> _logger;

        public UserCashbackController(
            ApplicationDbContext context,
            MasterDbContext masterContext,
            IHttpContextAccessor httpContextAccessor,
            ILogger<UserCashbackController> logger)
        {
            _context = context;
            _masterContext = masterContext;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        // GET: api/UserCashback?userId={id}
        [HttpGet]
        public async Task<IActionResult> GetUserCashbacks([FromQuery] int? userId)
        {
            try
            {
                IQueryable<UserCashback> query = _context.UserCashbacks
                    .Where(uc => uc.DeletedAt == null)
                    .Include(uc => uc.BillingProfile);

                if (userId.HasValue)
                {
                    query = query.Where(uc => uc.UserId == userId.Value);
                }

                var cashbacks = await query.ToListAsync();

                return Ok(cashbacks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user cashbacks for user {userId}");
                return StatusCode(500, new { error = "An error occurred while retrieving user cashbacks" });
            }
        }

        // GET: api/UserCashback/all
        [HttpGet("all")]
        public async Task<IActionResult> GetAllUserCashbacks()
        {
            try
            {
                var cashbacks = await _context.UserCashbacks
                    .Where(uc => uc.DeletedAt == null)
                    .Include(uc => uc.BillingProfile)
                    .OrderBy(uc => uc.UserId)
                    .ToListAsync();

                return Ok(cashbacks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all user cashbacks");
                return StatusCode(500, new { error = "An error occurred while retrieving user cashbacks" });
            }
        }

        // GET: api/UserCashback/user-ids
        [HttpGet("user-ids")]
        public async Task<IActionResult> GetUserIdsWithCashbacks()
        {
            try
            {
                var userIds = await _context.UserCashbacks
                    .Where(uc => uc.DeletedAt == null)
                    .Select(uc => uc.UserId)
                    .Distinct()
                    .ToListAsync();

                return Ok(userIds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user IDs with cashbacks");
                return StatusCode(500, new { error = "An error occurred while retrieving user IDs" });
            }
        }

        // POST: api/UserCashback
        [HttpPost]
        public async Task<IActionResult> SaveUserCashbacks([FromBody] SaveUserCashbacksRequest request)
        {
            try
            {
                var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

                // Verify the user exists
                var userExists = await _masterContext.Users.AnyAsync(u => u.Id == request.UserId);
                if (!userExists)
                {
                    return BadRequest(new { error = $"User with ID {request.UserId} does not exist" });
                }

                // Get existing cashbacks for this user
                var existingCashbacks = await _context.UserCashbacks
                    .Where(uc => uc.UserId == request.UserId && uc.DeletedAt == null)
                    .ToListAsync();

                // Process each amount in the request
                foreach (var item in request.Amounts)
                {
                    var existing = existingCashbacks.FirstOrDefault(uc => uc.BillingProfileId == item.BillingProfileId);

                    if (item.Amount > 0)
                    {
                        if (existing != null)
                        {
                            // Update existing
                            existing.Amount = item.Amount;
                            existing.UpdatedAt = DateTime.UtcNow;
                            existing.UpdatedBy = userEmail;
                        }
                        else
                        {
                            // Create new
                            var newCashback = new UserCashback
                            {
                                UserId = request.UserId,
                                BillingProfileId = item.BillingProfileId,
                                Amount = item.Amount,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = userEmail
                            };
                            _context.UserCashbacks.Add(newCashback);
                        }
                    }
                    else if (existing != null)
                    {
                        // Soft delete if amount is 0
                        existing.DeletedAt = DateTime.UtcNow;
                        existing.DeletedBy = userEmail;
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = "User cashbacks saved successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error saving user cashbacks for user {request.UserId}");
                return StatusCode(500, new { error = "An error occurred while saving user cashbacks" });
            }
        }

        // DELETE: api/UserCashback/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUserCashback(int id)
        {
            try
            {
            var cashback = await _context.UserCashbacks.FindAsync(id);
            if (cashback == null)
            {
                return NotFound(new { error = "User cashback not found" });
            }

            cashback.DeletedAt = DateTime.UtcNow;
            cashback.DeletedBy = User.GetSystemUserId();

                return Ok(new { message = "User cashback deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting user cashback {id}");
                return StatusCode(500, new { error = "An error occurred while deleting user cashback" });
            }
        }

        // DELETE: api/UserCashback/user/{userId}
        [HttpDelete("user/{userId}")]
        public async Task<IActionResult> DeleteAllUserCashbacks(int userId)
        {
            try
            {
                var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

                var cashbacks = await _context.UserCashbacks
                    .Where(uc => uc.UserId == userId && uc.DeletedAt == null)
                    .ToListAsync();

                foreach (var cashback in cashbacks)
                {
                    cashback.DeletedAt = DateTime.UtcNow;
                    cashback.DeletedBy = userEmail;
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = $"All cashbacks deleted for user {userId}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting all cashbacks for user {userId}");
                return StatusCode(500, new { error = "An error occurred while deleting user cashbacks" });
            }
        }

        // GET: api/UserCashback/calculate?userId={id}&billingProfileId={id}
        // Calculates the effective cashback amount for a user and billing profile
        // Priority: 1. Individual UserCashback, 2. CashbackGroup amount, 3. 0
        [HttpGet("calculate")]
        public async Task<IActionResult> CalculateCashback([FromQuery] int userId, [FromQuery] int billingProfileId)
        {
            try
            {
                decimal cashbackAmount = 0;
                string source = "none";

                // First check for individual user cashback
                var userCashback = await _context.UserCashbacks
                    .Where(uc => uc.UserId == userId && uc.BillingProfileId == billingProfileId && uc.DeletedAt == null)
                    .FirstOrDefaultAsync();

                if (userCashback != null && userCashback.Amount > 0)
                {
                    cashbackAmount = userCashback.Amount;
                    source = "individual";
                }
                else
                {
                    // Check if user belongs to a cashback group
                    var userGroup = await _context.CashbackGroupUsers
                        .Where(cgu => cgu.UserId == userId)
                        .Include(cgu => cgu.CashbackGroup)
                        .Where(cgu => cgu.CashbackGroup != null && cgu.CashbackGroup.DeletedAt == null)
                        .FirstOrDefaultAsync();

                    if (userGroup != null)
                    {
                        // Get the cashback amount for this group and billing profile
                        var groupCashback = await _context.CashbackProfileAmounts
                            .Where(cpa => cpa.CashbackGroupId == userGroup.CashbackGroupId && cpa.BillingProfileId == billingProfileId)
                            .FirstOrDefaultAsync();

                        if (groupCashback != null && groupCashback.Amount > 0)
                        {
                            cashbackAmount = groupCashback.Amount;
                            source = "group";
                        }
                    }
                }

                return Ok(new { 
                    userId = userId,
                    billingProfileId = billingProfileId,
                    cashbackAmount = cashbackAmount,
                    source = source
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calculating cashback for user {userId} and billing profile {billingProfileId}");
                return StatusCode(500, new { error = "An error occurred while calculating cashback" });
            }
        }
    }
}
