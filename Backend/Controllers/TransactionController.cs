using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using static Backend.Models.TransactionType;

namespace Backend.Controllers;

public class CreateTransactionRequest
{
    public string WalletType { get; set; } = null!; // 'custom' or 'user'
    public int? CustomWalletId { get; set; }
    public int? UserWalletId { get; set; }
    public string TransactionType { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string? Reason { get; set; }
    public string? Reference { get; set; }
    public string? PaymentMethod { get; set; }
}

[ApiController]
[Route("api/transactions")]
[Authorize]
public class TransactionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<TransactionController> _logger;

    public TransactionController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TransactionController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    // GET: api/transactions
    [HttpGet]
    public async Task<ActionResult<object>> GetTransactions(
        [FromQuery] string? walletType = null,
        [FromQuery] int? customWalletId = null,
        [FromQuery] int? userWalletId = null,
        [FromQuery] int? userId = null,
        [FromQuery] string? transactionType = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.Transactions.Where(t => !t.IsDeleted);

            if (!string.IsNullOrEmpty(walletType))
            {
                query = query.Where(t => t.WalletType == walletType);
            }

            if (customWalletId.HasValue)
            {
                query = query.Where(t => t.CustomWalletId == customWalletId);
            }

            if (userWalletId.HasValue)
            {
                query = query.Where(t => t.UserWalletId == userWalletId);
            }

            if (userId.HasValue)
            {
                query = query.Where(t => t.UserId == userId);
            }

            if (!string.IsNullOrEmpty(transactionType))
            {
                query = query.Where(t => t.TransactionType == transactionType);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(t => t.Status == status);
            }

            if (startDate.HasValue)
            {
                query = query.Where(t => t.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(t => t.CreatedAt <= endDate.Value);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var transactions = await query
                .Include(t => t.CustomWallet)
                .Include(t => t.UserWallet)
                .Include(t => t.RelatedTransaction)
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Get user details
            var userIds = transactions.Where(t => t.UserId.HasValue).Select(t => t.UserId!.Value).Distinct().ToList();
            var users = await _masterContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName })
                .ToListAsync();

            var result = transactions.Select(t =>
            {
                var user = users.FirstOrDefault(u => u.Id == t.UserId);
                return new
                {
                    t.Id,
                    t.WalletType,
                    t.CustomWalletId,
                    CustomWalletName = t.CustomWallet?.Name,
                    t.UserWalletId,
                    t.UserId,
                    UserEmail = user?.Email,
                    UserName = user != null ? $"{user.FirstName} {user.LastName}" : null,
                    t.TransactionType,
                    t.IsCredit,
                    t.Amount,
                    t.Status,
                    t.BalanceBefore,
                    t.BalanceAfter,
                    t.Description,
                    t.Reason,
                    t.Reference,
                    t.PaymentMethod,
                    t.RelatedTransactionId,
                    t.CreatedAt,
                    t.CreatedBy
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
            _logger.LogError(ex, "Error retrieving transactions");
            return StatusCode(500, new { error = "An error occurred while retrieving transactions" });
        }
    }

    // GET: api/transactions/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetTransaction(int id)
    {
        try
        {
            var transaction = await _context.Transactions
                .Include(t => t.CustomWallet)
                .Include(t => t.UserWallet)
                .Include(t => t.RelatedTransaction)
                .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

            if (transaction == null)
            {
                return NotFound(new { error = "Transaction not found" });
            }

            object? user = null;
            if (transaction.UserId.HasValue)
            {
                user = await _masterContext.Users
                    .Where(u => u.Id == transaction.UserId.Value)
                    .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName })
                    .FirstOrDefaultAsync();
            }

            return Ok(new
            {
                transaction.Id,
                transaction.WalletType,
                transaction.CustomWalletId,
                CustomWalletName = transaction.CustomWallet?.Name,
                transaction.UserWalletId,
                transaction.UserId,
                UserEmail = user?.GetType().GetProperty("Email")?.GetValue(user),
                UserName = user != null ? $"{user.GetType().GetProperty("FirstName")?.GetValue(user)} {user.GetType().GetProperty("LastName")?.GetValue(user)}" : null,
                transaction.TransactionType,
                transaction.IsCredit,
                transaction.Amount,
                transaction.Status,
                transaction.BalanceBefore,
                transaction.BalanceAfter,
                transaction.Description,
                transaction.Reason,
                transaction.Reference,
                transaction.PaymentMethod,
                transaction.RelatedTransactionId,
                transaction.CreatedAt,
                transaction.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving transaction");
            return StatusCode(500, new { error = "An error occurred while retrieving the transaction" });
        }
    }

    // POST: api/transactions
    [HttpPost]
    public async Task<ActionResult<object>> CreateTransaction([FromBody] CreateTransactionRequest request)
    {
        try
        {
            if (request.Amount <= 0)
            {
                return BadRequest(new { error = "Amount must be greater than zero" });
            }

            decimal balanceBefore = 0;
            decimal balanceAfter = 0;
            int? userId = null;

            if (request.WalletType == "custom")
            {
                if (!request.CustomWalletId.HasValue)
                {
                    return BadRequest(new { error = "Custom wallet ID is required" });
                }

                var wallet = await _context.CustomWallets.FindAsync(request.CustomWalletId.Value);
                if (wallet == null || wallet.IsDeleted)
                {
                    return NotFound(new { error = "Custom wallet not found" });
                }

                balanceBefore = wallet.CurrentBalance;
                var isCredit = Backend.Models.TransactionType.IsCredit(request.TransactionType);
                wallet.CurrentBalance += isCredit ? request.Amount : -request.Amount;
                balanceAfter = wallet.CurrentBalance;
                wallet.UpdatedAt = DateTime.UtcNow;
            }
            else if (request.WalletType == "user")
            {
                if (!request.UserWalletId.HasValue)
                {
                    return BadRequest(new { error = "User wallet ID is required" });
                }

                var wallet = await _context.UserWallets.FindAsync(request.UserWalletId.Value);
                if (wallet == null || wallet.IsDeleted)
                {
                    return NotFound(new { error = "User wallet not found" });
                }

                balanceBefore = wallet.CurrentBalance;
                var isCredit = Backend.Models.TransactionType.IsCredit(request.TransactionType);
                wallet.CurrentBalance += isCredit ? request.Amount : -request.Amount;
                balanceAfter = wallet.CurrentBalance;
                wallet.UpdatedAt = DateTime.UtcNow;
                userId = wallet.UserId;
            }
            else
            {
                return BadRequest(new { error = "Invalid wallet type" });
            }

            var transaction = new Models.Transaction
            {
                WalletType = request.WalletType,
                CustomWalletId = request.CustomWalletId,
                UserWalletId = request.UserWalletId,
                UserId = userId,
                TransactionType = request.TransactionType,
                IsCredit = Backend.Models.TransactionType.IsCredit(request.TransactionType),
                Amount = request.Amount,
                Status = "completed",
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                Description = request.Description,
                Reason = request.Reason,
                Reference = request.Reference,
                PaymentMethod = request.PaymentMethod,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.Transactions.Add(transaction);

            // Also create wallet history record
            var history = new WalletHistory
            {
                WalletType = request.WalletType,
                CustomWalletId = request.CustomWalletId,
                UserWalletId = request.UserWalletId,
                UserId = userId,
                TransactionType = request.TransactionType,
                IsCredit = transaction.IsCredit,
                Amount = request.Amount,
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                Description = request.Description,
                Reason = request.Reason,
                Reference = request.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.WalletHistories.Add(history);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetTransaction),
                new { id = transaction.Id },
                new
                {
                    transaction.Id,
                    transaction.WalletType,
                    transaction.TransactionType,
                    transaction.Amount,
                    transaction.Status,
                    balanceBefore,
                    balanceAfter,
                    transaction.CreatedAt
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating transaction");
            return StatusCode(500, new { error = "An error occurred while creating the transaction" });
        }
    }

    // DELETE: api/transactions/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTransaction(int id)
    {
        try
        {
            var transaction = await _context.Transactions
                .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

            if (transaction == null)
            {
                return NotFound(new { error = "Transaction not found" });
            }

            if (transaction.Status == "reversed")
            {
                return BadRequest(new { error = "Transaction already reversed" });
            }

            // Reverse the balance
            decimal reversedBalanceBefore = 0;
            decimal reversedBalanceAfter = 0;

            if (transaction.WalletType == "custom" && transaction.CustomWalletId.HasValue)
            {
                var wallet = await _context.CustomWallets.FindAsync(transaction.CustomWalletId.Value);
                if (wallet != null && !wallet.IsDeleted)
                {
                    reversedBalanceBefore = wallet.CurrentBalance;
                    // Reverse: if it was credit, deduct; if it was debit, add back
                    wallet.CurrentBalance += transaction.IsCredit ? -transaction.Amount : transaction.Amount;
                    reversedBalanceAfter = wallet.CurrentBalance;
                    wallet.UpdatedAt = DateTime.UtcNow;
                }
            }
            else if (transaction.WalletType == "user" && transaction.UserWalletId.HasValue)
            {
                var wallet = await _context.UserWallets.FindAsync(transaction.UserWalletId.Value);
                if (wallet != null && !wallet.IsDeleted)
                {
                    reversedBalanceBefore = wallet.CurrentBalance;
                    // Reverse: if it was credit, deduct; if it was debit, add back
                    wallet.CurrentBalance += transaction.IsCredit ? -transaction.Amount : transaction.Amount;
                    reversedBalanceAfter = wallet.CurrentBalance;
                    wallet.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Mark original transaction as reversed
            transaction.Status = "reversed";
            transaction.UpdatedAt = DateTime.UtcNow;
            transaction.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            // Create reversal transaction
            var reversalTransaction = new Models.Transaction
            {
                WalletType = transaction.WalletType,
                CustomWalletId = transaction.CustomWalletId,
                UserWalletId = transaction.UserWalletId,
                UserId = transaction.UserId,
                TransactionType = transaction.TransactionType,
                IsCredit = !transaction.IsCredit, // Opposite of original
                Amount = transaction.Amount,
                Status = "completed",
                BalanceBefore = reversedBalanceBefore,
                BalanceAfter = reversedBalanceAfter,
                Description = $"Reversal of transaction #{transaction.Id}",
                Reason = "Transaction deleted/reversed",
                Reference = transaction.Reference,
                RelatedTransactionId = transaction.Id,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.Transactions.Add(reversalTransaction);

            // Create history record for reversal
            var reversalHistory = new WalletHistory
            {
                WalletType = transaction.WalletType,
                CustomWalletId = transaction.CustomWalletId,
                UserWalletId = transaction.UserWalletId,
                UserId = transaction.UserId,
                TransactionType = transaction.TransactionType,
                IsCredit = !transaction.IsCredit,
                Amount = transaction.Amount,
                BalanceBefore = reversedBalanceBefore,
                BalanceAfter = reversedBalanceAfter,
                Description = $"Reversal of transaction #{transaction.Id}",
                Reason = "Transaction deleted/reversed",
                Reference = transaction.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system"
            };

            _context.WalletHistories.Add(reversalHistory);

            // Soft delete the original transaction
            transaction.IsDeleted = true;
            transaction.DeletedAt = DateTime.UtcNow;
            transaction.DeletedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Transaction reversed successfully",
                originalTransactionId = transaction.Id,
                reversalTransactionId = reversalTransaction.Id,
                balanceAfter = reversedBalanceAfter
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting transaction");
            return StatusCode(500, new { error = "An error occurred while deleting the transaction" });
        }
    }

    // GET: api/transactions/stats
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
            var query = _context.Transactions.Where(t => !t.IsDeleted && t.Status == "completed");

            if (!string.IsNullOrEmpty(walletType))
            {
                query = query.Where(t => t.WalletType == walletType);
            }

            if (customWalletId.HasValue)
            {
                query = query.Where(t => t.CustomWalletId == customWalletId);
            }

            if (userWalletId.HasValue)
            {
                query = query.Where(t => t.UserWalletId == userWalletId);
            }

            if (startDate.HasValue)
            {
                query = query.Where(t => t.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(t => t.CreatedAt <= endDate.Value);
            }

            var totalTransactions = await query.CountAsync();
            var totalCredit = await query.Where(t => t.IsCredit).SumAsync(t => t.Amount);
            var totalDebit = await query.Where(t => !t.IsCredit).SumAsync(t => t.Amount);

            var byType = await query
                .GroupBy(t => t.TransactionType)
                .Select(g => new
                {
                    TransactionType = g.Key,
                    TotalAmount = g.Sum(t => t.Amount),
                    Count = g.Count()
                })
                .ToListAsync();

            return Ok(new
            {
                totalTransactions,
                totalCredit,
                totalDebit,
                netAmount = totalCredit - totalDebit,
                byType
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving transaction stats");
            return StatusCode(500, new { error = "An error occurred while retrieving stats" });
        }
    }
}
