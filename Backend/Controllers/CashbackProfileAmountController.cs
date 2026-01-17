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
    public class CashbackProfileAmountController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<CashbackProfileAmountController> _logger;

        public CashbackProfileAmountController(
            ApplicationDbContext context,
            IHttpContextAccessor httpContextAccessor,
            ILogger<CashbackProfileAmountController> logger)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        // GET: api/CashbackProfileAmount?groupId={id}
        [HttpGet]
        public async Task<IActionResult> GetAmountsByGroup([FromQuery] int groupId)
        {
            try
            {
                var amounts = await _context.CashbackProfileAmounts
                    .Where(a => a.CashbackGroupId == groupId && a.DeletedAt == null)
                    .Include(a => a.BillingProfile)
                    .Where(a => a.BillingProfile != null && a.BillingProfile.IsActive)
                    .ToListAsync();

                return Ok(amounts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting cashback amounts for group {groupId}");
                return StatusCode(500, new { error = "An error occurred while retrieving cashback amounts" });
            }
        }

        // POST: api/CashbackProfileAmount
        [HttpPost]
        public async Task<IActionResult> SaveAmounts([FromBody] SaveCashbackAmountsRequest request)
        {
            try
            {
                var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

                // Get existing amounts for this group
                var existingAmounts = await _context.CashbackProfileAmounts
                    .Where(a => a.CashbackGroupId == request.CashbackGroupId && a.DeletedAt == null)
                    .ToListAsync();

                // Process each amount in the request
                foreach (var item in request.Amounts)
                {
                    var existing = existingAmounts.FirstOrDefault(a => a.BillingProfileId == item.BillingProfileId);

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
                            var newAmount = new CashbackProfileAmount
                            {
                                CashbackGroupId = request.CashbackGroupId,
                                BillingProfileId = item.BillingProfileId,
                                Amount = item.Amount,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = userEmail
                            };
                            _context.CashbackProfileAmounts.Add(newAmount);
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

                return Ok(new { message = "Cashback amounts saved successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving cashback amounts");
                return StatusCode(500, new { error = "An error occurred while saving cashback amounts" });
            }
        }

        // DELETE: api/CashbackProfileAmount/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var amount = await _context.CashbackProfileAmounts.FindAsync(id);
                if (amount == null)
                {
                    return NotFound(new { error = "Cashback amount not found" });
                }

                var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";
                amount.DeletedAt = DateTime.UtcNow;
                amount.DeletedBy = userEmail;

                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting cashback amount {id}");
                return StatusCode(500, new { error = "An error occurred while deleting the cashback amount" });
            }
        }
    }
}
