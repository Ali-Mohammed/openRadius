using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using static Backend.Models.TransactionType;

namespace Backend.Controllers;

public class TopUpRequest
{
    public string WalletType { get; set; } = null!; // 'custom' or 'user'
    public int? CustomWalletId { get; set; }
    public int? UserWalletId { get; set; }
    public decimal Amount { get; set; }
    public string? Reason { get; set; }
    public string? Reference { get; set; }
}

[ApiController]
[Route("api/topup")]
[Authorize]
public class TopUpController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<TopUpController> _logger;

    public TopUpController(
        ApplicationDbContext context,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TopUpController> logger)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    // POST: api/topup/custom-wallet
    [HttpPost("custom-wallet")]
    public async Task<ActionResult<object>> TopUpCustomWallet([FromBody] TopUpRequest request)
    {
        try
        {
            if (!request.CustomWalletId.HasValue)
            {
                return BadRequest(new { error = "Custom wallet ID is required" });
            }

            if (request.Amount <= 0)
            {
                return BadRequest(new { error = "Amount must be greater than zero" });
            }

            var wallet = await _context.CustomWallets.FindAsync(request.CustomWalletId.Value);
            if (wallet == null || wallet.IsDeleted)
            {
                return NotFound(new { error = "Custom wallet not found" });
            }

            var balanceBefore = wallet.CurrentBalance;
            wallet.CurrentBalance += request.Amount;
            wallet.UpdatedAt = DateTime.UtcNow;

            // Create history record
            var history = new WalletHistory
            {
                WalletType = "custom",
                CustomWalletId = wallet.Id,
                TransactionType = TopUp,
                AmountType = "credit",
                Amount = request.Amount,
                BalanceBefore = balanceBefore,
                BalanceAfter = wallet.CurrentBalance,
                Reason = request.Reason,
                Reference = request.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.WalletHistories.Add(history);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                walletId = wallet.Id,
                walletName = wallet.Name,
                balanceBefore,
                balanceAfter = wallet.CurrentBalance,
                amount = request.Amount,
                historyId = history.Id
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing custom wallet top-up");
            return StatusCode(500, new { error = "An error occurred while processing the top-up" });
        }
    }

    // POST: api/topup/user-wallet
    [HttpPost("user-wallet")]
    public async Task<ActionResult<object>> TopUpUserWallet([FromBody] TopUpRequest request)
    {
        try
        {
            if (!request.UserWalletId.HasValue)
            {
                return BadRequest(new { error = "User wallet ID is required" });
            }

            if (request.Amount <= 0)
            {
                return BadRequest(new { error = "Amount must be greater than zero" });
            }

            var wallet = await _context.UserWallets.FindAsync(request.UserWalletId.Value);
            if (wallet == null || wallet.IsDeleted)
            {
                return NotFound(new { error = "User wallet not found" });
            }

            var balanceBefore = wallet.CurrentBalance;
            wallet.CurrentBalance += request.Amount;
            wallet.UpdatedAt = DateTime.UtcNow;

            // Create history record
            var history = new WalletHistory
            {
                WalletType = "user",
                UserWalletId = wallet.Id,
                UserId = wallet.UserId,
                TransactionType = TopUp,
                AmountType = "credit",
                Amount = request.Amount,
                BalanceBefore = balanceBefore,
                BalanceAfter = wallet.CurrentBalance,
                Reason = request.Reason,
                Reference = request.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.WalletHistories.Add(history);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                walletId = wallet.Id,
                userId = wallet.UserId,
                balanceBefore,
                balanceAfter = wallet.CurrentBalance,
                amount = request.Amount,
                historyId = history.Id
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing user wallet top-up");
            return StatusCode(500, new { error = "An error occurred while processing the top-up" });
        }
    }
}
