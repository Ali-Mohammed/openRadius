using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

public class CreateUserWalletRequest
{
    public int UserId { get; set; }
    public decimal CurrentBalance { get; set; } = 0;
    public decimal? MaxFillLimit { get; set; }
    public decimal? DailySpendingLimit { get; set; }
    public string Status { get; set; } = "active";
    public string? CustomWalletColor { get; set; }
    public string? CustomWalletIcon { get; set; }
    public bool? AllowNegativeBalance { get; set; }
}

public class UpdateUserWalletRequest
{
    public decimal CurrentBalance { get; set; }
    public decimal? MaxFillLimit { get; set; }
    public decimal? DailySpendingLimit { get; set; }
    public string Status { get; set; } = "active";
    public bool? AllowNegativeBalance { get; set; }
}

[ApiController]
[Route("api/user-wallets")]
[Authorize]
public class UserWalletController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<UserWalletController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserWalletController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        ILogger<UserWalletController> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _masterContext = masterContext;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // GET: api/user-wallets
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetUserWallets(
        [FromQuery] int? userId = null,
        [FromQuery] int? customWalletId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.UserWallets
                .Include(uw => uw.CustomWallet)
                .AsQueryable();

            // Apply filters
            if (userId.HasValue)
            {
                query = query.Where(uw => uw.UserId == userId.Value);
            }

            if (customWalletId.HasValue)
            {
                query = query.Where(uw => uw.CustomWalletId == customWalletId.Value);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(uw => uw.Status == status);
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(uw => 
                    uw.CustomWallet.Name.Contains(search));
            }

            var totalCount = await query.CountAsync();

            // Get user IDs to fetch user details from master DB
            var userWallets = await query
                .OrderByDescending(uw => uw.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = userWallets.Select(uw => uw.UserId).Distinct().ToList();
            var users = await _masterContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName })
                .ToListAsync();

            var result = userWallets.Select(uw =>
            {
                var user = users.FirstOrDefault(u => u.Id == uw.UserId);
                return new
                {
                    uw.Id,
                    uw.UserId,
                    UserEmail = user?.Email,
                    UserName = user != null ? $"{user.FirstName} {user.LastName}" : "Unknown User",
                    uw.CustomWalletId,
                    CustomWalletName = uw.CustomWallet?.Name,
                    CustomWalletType = uw.CustomWallet?.Type,
                    CustomWalletColor = uw.CustomWalletColor ?? uw.CustomWallet?.Color,
                    CustomWalletIcon = uw.CustomWalletIcon ?? uw.CustomWallet?.Icon,
                    uw.CurrentBalance,
                    uw.MaxFillLimit,
                    uw.DailySpendingLimit,
                    uw.Status,
                    uw.AllowNegativeBalance,
                    uw.CreatedAt,
                    uw.UpdatedAt
                };
            }).ToList();

            return Ok(new
            {
                data = result,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user wallets");
            return StatusCode(500, new { error = "An error occurred while retrieving user wallets" });
        }
    }

    // GET: api/user-wallets/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetUserWallet(int id)
    {
        try
        {
            var userWallet = await _context.UserWallets
                .Include(uw => uw.CustomWallet)
                .FirstOrDefaultAsync(uw => uw.Id == id);

            if (userWallet == null)
            {
                return NotFound(new { error = "User wallet not found" });
            }

            var user = await _masterContext.Users
                .Where(u => u.Id == userWallet.UserId)
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName })
                .FirstOrDefaultAsync();

            return Ok(new
            {
                userWallet.Id,
                userWallet.UserId,
                UserEmail = user?.Email,
                UserName = user != null ? $"{user.FirstName} {user.LastName}" : "Unknown User",
                userWallet.CustomWalletId,
                CustomWalletName = userWallet.CustomWallet?.Name,
                CustomWalletType = userWallet.CustomWallet?.Type,
                CustomWalletColor = userWallet.CustomWalletColor ?? userWallet.CustomWallet?.Color,
                CustomWalletIcon = userWallet.CustomWalletIcon ?? userWallet.CustomWallet?.Icon,
                userWallet.CurrentBalance,
                userWallet.MaxFillLimit,
                userWallet.DailySpendingLimit,
                userWallet.Status,
                userWallet.AllowNegativeBalance,
                userWallet.CreatedAt,
                userWallet.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user wallet");
            return StatusCode(500, new { error = "An error occurred while retrieving the user wallet" });
        }
    }

    // POST: api/user-wallets
    [HttpPost]
    public async Task<ActionResult<object>> CreateUserWallet([FromBody] CreateUserWalletRequest request)
    {
        try
        {
            // Verify user exists in master DB
            var userExists = await _masterContext.Users.AnyAsync(u => u.Id == request.UserId);
            if (!userExists)
            {
                return BadRequest(new { error = "User not found" });
            }

            // Check if user already has a wallet
            var existingWallet = await _context.UserWallets
                .FirstOrDefaultAsync(uw => uw.UserId == request.UserId && !uw.IsDeleted);

            if (existingWallet != null)
            {
                return BadRequest(new { error = "User already has a wallet" });
            }

            var userWallet = new UserWallet
            {
                UserId = request.UserId,
                CustomWalletId = null,
                CurrentBalance = request.CurrentBalance,
                MaxFillLimit = request.MaxFillLimit,
                DailySpendingLimit = request.DailySpendingLimit,
                Status = request.Status,
                CustomWalletColor = request.CustomWalletColor,
                CustomWalletIcon = request.CustomWalletIcon,
                AllowNegativeBalance = request.AllowNegativeBalance,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system",
                CreatedAt = DateTime.UtcNow
            };

            _context.UserWallets.Add(userWallet);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetUserWallet),
                new { id = userWallet.Id },
                new
                {
                    userWallet.Id,
                    userWallet.UserId,
                    userWallet.CustomWalletId,
                    userWallet.CustomWalletColor,
                    userWallet.CustomWalletIcon,
                    userWallet.CurrentBalance,
                    userWallet.MaxFillLimit,
                    userWallet.DailySpendingLimit,
                    userWallet.Status,
                    userWallet.AllowNegativeBalance,
                    userWallet.CreatedAt
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user wallet");
            return StatusCode(500, new { error = "An error occurred while creating the user wallet" });
        }
    }

    // PUT: api/user-wallets/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUserWallet(int id, [FromBody] UpdateUserWalletRequest request)
    {
        try
        {
            var existingWallet = await _context.UserWallets.FindAsync(id);
            if (existingWallet == null)
            {
                return NotFound(new { error = "User wallet not found" });
            }

            // Update fields
            existingWallet.CurrentBalance = request.CurrentBalance;
            existingWallet.MaxFillLimit = request.MaxFillLimit;
            existingWallet.DailySpendingLimit = request.DailySpendingLimit;
            existingWallet.Status = request.Status;
            existingWallet.AllowNegativeBalance = request.AllowNegativeBalance;
            existingWallet.UpdatedAt = DateTime.UtcNow;
            existingWallet.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user wallet");
            return StatusCode(500, new { error = "An error occurred while updating the user wallet" });
        }
    }

    // DELETE: api/user-wallets/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUserWallet(int id)
    {
        try
        {
            var userWallet = await _context.UserWallets.FindAsync(id);
            if (userWallet == null)
            {
                return NotFound(new { error = "User wallet not found" });
            }

            // Soft delete
            userWallet.IsDeleted = true;
            userWallet.DeletedAt = DateTime.UtcNow;
            userWallet.DeletedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user wallet");
            return StatusCode(500, new { error = "An error occurred while deleting the user wallet" });
        }
    }

    // POST: api/user-wallets/{id}/adjust-balance
    [HttpPost("{id}/adjust-balance")]
    public async Task<IActionResult> AdjustBalance(int id, [FromBody] BalanceAdjustmentRequest request)
    {
        try
        {
            var userWallet = await _context.UserWallets
                .Include(uw => uw.CustomWallet)
                .FirstOrDefaultAsync(uw => uw.Id == id);

            if (userWallet == null)
            {
                return NotFound(new { error = "User wallet not found" });
            }

            var balanceBefore = userWallet.CurrentBalance;
            var newBalance = userWallet.CurrentBalance + request.Amount;

            // Check if negative balance is allowed
            var allowNegative = userWallet.AllowNegativeBalance ?? userWallet.CustomWallet?.AllowNegativeBalance ?? false;
            if (!allowNegative && newBalance < 0)
            {
                return BadRequest(new { error = "Negative balance not allowed for this wallet" });
            }

            userWallet.CurrentBalance = newBalance;
            userWallet.UpdatedAt = DateTime.UtcNow;

            // Create history record
            var history = new WalletHistory
            {
                WalletType = "user",
                UserWalletId = userWallet.Id,
                UserId = userWallet.UserId,
                TransactionType = Backend.Models.TransactionType.Adjustment,
                AmountType = request.Amount > 0 ? "credit" : "debit",
                Amount = Math.Abs(request.Amount),
                BalanceBefore = balanceBefore,
                BalanceAfter = newBalance,
                Reason = request.Reason,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.WalletHistories.Add(history);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = userWallet.Id,
                previousBalance = balanceBefore,
                newBalance = userWallet.CurrentBalance,
                adjustment = request.Amount,
                historyId = history.Id
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adjusting wallet balance");
            return StatusCode(500, new { error = "An error occurred while adjusting the balance" });
        }
    }
}

public class BalanceAdjustmentRequest
{
    public decimal Amount { get; set; }
    public string? Reason { get; set; }
}
