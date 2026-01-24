using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/wallet-history")]
[Authorize]
public class WalletHistoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<WalletHistoryController> _logger;

    public WalletHistoryController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        ILogger<WalletHistoryController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _logger = logger;
    }

    // GET: api/wallet-history
    [HttpGet]
    public async Task<ActionResult<object>> GetHistory(
        [FromQuery] string? walletType = null,
        [FromQuery] int? customWalletId = null,
        [FromQuery] int? userWalletId = null,
        [FromQuery] int? userId = null,
        [FromQuery] string? transactionType = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.WalletHistories.AsQueryable();

            if (!string.IsNullOrEmpty(walletType))
            {
                query = query.Where(h => h.WalletType == walletType);
            }

            if (customWalletId.HasValue)
            {
                query = query.Where(h => h.CustomWalletId == customWalletId);
            }

            if (userWalletId.HasValue)
            {
                query = query.Where(h => h.UserWalletId == userWalletId);
            }

            if (userId.HasValue)
            {
                query = query.Where(h => h.UserId == userId);
            }

            if (!string.IsNullOrEmpty(transactionType))
            {
                query = query.Where(h => h.TransactionType == transactionType);
            }

            if (startDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt <= endDate.Value);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var histories = await query
                .Include(h => h.CustomWallet)
                .Include(h => h.UserWallet)
                .OrderByDescending(h => h.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Get user details for user wallet transactions
            var userIds = histories.Where(h => h.UserId.HasValue).Select(h => h.UserId!.Value).Distinct().ToList();
            var users = await _masterContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName })
                .ToListAsync();

            var result = histories.Select(h =>
            {
                var user = users.FirstOrDefault(u => u.Id == h.UserId);
                return new
                {
                    h.Id,
                    h.WalletType,
                    h.CustomWalletId,
                    CustomWalletName = h.CustomWallet?.Name,
                    h.UserWalletId,
                    h.UserId,
                    UserEmail = user?.Email,
                    UserName = user != null ? $"{user.FirstName} {user.LastName}" : null,
                    h.TransactionType,
                    h.AmountType,
                    h.Amount,
                    h.BalanceBefore,
                    h.BalanceAfter,
                    h.Description,
                    h.Reason,
                    h.Reference,
                    h.CreatedAt,
                    h.CreatedBy
                };
            }).ToList();

            return Ok(new
            {
                data = result,
                currentPage = page,
                pageSize,
                totalCount,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving wallet history");
            return StatusCode(500, new { error = "An error occurred while retrieving wallet history" });
        }
    }

    // GET: api/wallet-history/stats
    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetStats(
        [FromQuery] string? walletType = null,
        [FromQuery] int? customWalletId = null,
        [FromQuery] int? userWalletId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var query = _context.WalletHistories.AsQueryable();

            if (!string.IsNullOrEmpty(walletType))
            {
                query = query.Where(h => h.WalletType == walletType);
            }

            if (customWalletId.HasValue)
            {
                query = query.Where(h => h.CustomWalletId == customWalletId);
            }

            if (userWalletId.HasValue)
            {
                query = query.Where(h => h.UserWalletId == userWalletId);
            }

            if (startDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt <= endDate.Value);
            }

            var stats = await query.GroupBy(h => h.TransactionType)
                .Select(g => new
                {
                    TransactionType = g.Key,
                    TotalAmount = g.Sum(h => h.Amount),
                    Count = g.Count()
                })
                .ToListAsync();

            var totalTransactions = await query.CountAsync();
            var totalAmount = await query.SumAsync(h => h.Amount);

            return Ok(new
            {
                totalTransactions,
                totalAmount,
                byType = stats
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving wallet history stats");
            return StatusCode(500, new { error = "An error occurred while retrieving stats" });
        }
    }
}
