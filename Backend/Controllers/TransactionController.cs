using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using static Backend.Models.TransactionType;
using Backend.Helpers;

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

public class BulkDeleteRequest
{
    public List<int> Ids { get; set; } = new();
    public string? Reason { get; set; }
}

public class BulkRestoreRequest
{
    public List<int> Ids { get; set; } = new();
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
        [FromQuery] bool includeDeleted = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            _logger.LogInformation($"GetTransactions called with includeDeleted={includeDeleted}");
            
            // If includeDeleted is true, show ONLY deleted transactions (trash view)
            // If false, show only active transactions
            // IMPORTANT: Use IgnoreQueryFilters() to bypass the global soft-delete filter
            var query = includeDeleted 
                ? _context.Transactions.IgnoreQueryFilters().Where(t => t.IsDeleted)
                : _context.Transactions.Where(t => !t.IsDeleted);
            
            var deletedCount = await _context.Transactions.IgnoreQueryFilters().CountAsync(t => t.IsDeleted);
            var activeCount = await _context.Transactions.CountAsync(t => !t.IsDeleted);
            _logger.LogInformation($"Database has {deletedCount} deleted and {activeCount} active transactions");

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
                    t.AmountType,
                    t.Amount,
                    t.Status,
                    t.BalanceBefore,
                    t.BalanceAfter,
                    t.Description,
                    t.Reason,
                    t.Reference,
                    t.PaymentMethod,
                    t.RelatedTransactionId,
                    t.RadiusUserId,
                    t.RadiusUsername,
                    t.RadiusProfileId,
                    t.RadiusProfileName,
                    t.BillingProfileId,
                    t.BillingProfileName,
                    t.IsDeleted,
                    t.DeletedAt,
                    t.DeletedBy,
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
                transaction.AmountType,
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
            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";
            
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
                var amountType = Backend.Models.TransactionType.GetAmountType(request.TransactionType);
                wallet.CurrentBalance += amountType == "credit" ? request.Amount : -request.Amount;
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
                var amountType = Backend.Models.TransactionType.GetAmountType(request.TransactionType);
                wallet.CurrentBalance += amountType == "credit" ? request.Amount : -request.Amount;
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
                AmountType = Backend.Models.TransactionType.GetAmountType(request.TransactionType),
                Amount = request.Amount,
                Status = "completed",
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                Description = request.Description,
                Reason = request.Reason,
                Reference = request.Reference,
                PaymentMethod = request.PaymentMethod,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
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
                AmountType = transaction.AmountType,
                Amount = request.Amount,
                BalanceBefore = balanceBefore,
                BalanceAfter = balanceAfter,
                Description = request.Description,
                Reason = request.Reason,
                Reference = request.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _context.WalletHistories.Add(history);
            await _context.SaveChangesAsync();

            // Create transaction history entry
            var transactionHistory = new TransactionHistory
            {
                TransactionId = transaction.Id,
                Action = "Created",
                Changes = System.Text.Json.JsonSerializer.Serialize(new
                {
                    transactionType = request.TransactionType,
                    amount = request.Amount,
                    walletType = request.WalletType,
                    status = "completed",
                    balanceBefore,
                    balanceAfter
                }),
                PerformedBy = userEmail,
                PerformedAt = DateTime.UtcNow
            };
            _context.TransactionHistories.Add(transactionHistory);
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

    public class DeleteTransactionRequest
    {
        public string? Reason { get; set; }
    }

    // DELETE: api/transactions/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTransaction(int id, [FromBody] DeleteTransactionRequest? request)
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

            var deleteReason = request?.Reason ?? "Transaction deleted";

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
                    wallet.CurrentBalance += transaction.AmountType == "credit" ? -transaction.Amount : transaction.Amount;
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
                    wallet.CurrentBalance += transaction.AmountType == "credit" ? -transaction.Amount : transaction.Amount;
                    reversedBalanceAfter = wallet.CurrentBalance;
                    wallet.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Mark original transaction as reversed
            transaction.Status = "reversed";
            transaction.UpdatedAt = DateTime.UtcNow;
            transaction.UpdatedBy = User.GetSystemUserId();

            // Create reversal transaction (also mark as deleted so it doesn't show in main view)
            var reversalTransaction = new Models.Transaction
            {
                WalletType = transaction.WalletType,
                CustomWalletId = transaction.CustomWalletId,
                UserWalletId = transaction.UserWalletId,
                UserId = transaction.UserId,
                TransactionType = transaction.TransactionType,
                AmountType = transaction.AmountType == "credit" ? "debit" : "credit", // Opposite of original
                Amount = transaction.Amount,
                Status = "completed",
                BalanceBefore = reversedBalanceBefore,
                BalanceAfter = reversedBalanceAfter,
                Description = $"Reversal of transaction #{transaction.Id}",
                Reason = deleteReason,
                Reference = transaction.Reference,
                RelatedTransactionId = transaction.Id,
                IsDeleted = true, // Mark reversal as deleted too
                DeletedAt = DateTime.UtcNow,
                DeletedBy = User.GetSystemUserId(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
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
                AmountType = reversalTransaction.AmountType,
                Amount = transaction.Amount,
                BalanceBefore = reversedBalanceBefore,
                BalanceAfter = reversedBalanceAfter,
                Description = $"Reversal of transaction #{transaction.Id}",
                Reason = deleteReason,
                Reference = transaction.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _context.WalletHistories.Add(reversalHistory);

            // Soft delete the original transaction
            transaction.IsDeleted = true;
            transaction.DeletedAt = DateTime.UtcNow;
            transaction.DeletedBy = User.GetSystemUserId();

            await _context.SaveChangesAsync();

            // Create transaction history entry for deletion
            var deletionHistory = new TransactionHistory
            {
                TransactionId = transaction.Id,
                Action = "Deleted",
                Changes = System.Text.Json.JsonSerializer.Serialize(new
                {
                    reason = deleteReason,
                    reversalTransactionId = reversalTransaction.Id,
                    balanceAfterReversal = reversedBalanceAfter
                }),
                PerformedBy = userEmail,
                PerformedAt = DateTime.UtcNow
            };
            _context.TransactionHistories.Add(deletionHistory);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Transaction reversed successfully",
                originalTransactionId = transaction.Id,
                reversalTransactionId = reversalTransaction.Id,
                reversalHistoryId = reversalHistory.Id,
                balanceAfter = reversedBalanceAfter,
                reason = deleteReason
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting transaction");
            return StatusCode(500, new { error = "An error occurred while deleting the transaction" });
        }
    }

    // POST: api/transactions/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreTransaction(int id)
    {
        try
        {
            // First check if transaction exists at all
            var anyTransaction = await _context.Transactions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == id);

            if (anyTransaction == null)
            {
                _logger.LogWarning($"Transaction {id} not found in database");
                return NotFound(new { error = $"Transaction {id} not found" });
            }

            if (!anyTransaction.IsDeleted)
            {
                _logger.LogWarning($"Transaction {id} is not deleted (IsDeleted = false)");
                return BadRequest(new { error = "Transaction is not deleted and cannot be restored" });
            }

            var transaction = anyTransaction;

            // Find the reversal transaction (it will also be marked as deleted)
            var reversalTransaction = await _context.Transactions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.RelatedTransactionId == id && t.IsDeleted);

            // If no reversal transaction found, we can still restore but without removing a reversal
            if (reversalTransaction == null)
            {
                _logger.LogWarning($"No reversal transaction found for transaction {id}. Restoring without reversal removal.");
            }

            // Restore the balance
            decimal restoredBalanceBefore = 0;
            decimal restoredBalanceAfter = 0;

            if (transaction.WalletType == "custom" && transaction.CustomWalletId.HasValue)
            {
                var wallet = await _context.CustomWallets.FindAsync(transaction.CustomWalletId.Value);
                if (wallet != null && !wallet.IsDeleted)
                {
                    restoredBalanceBefore = wallet.CurrentBalance;
                    // Restore: reapply the original transaction
                    wallet.CurrentBalance += transaction.AmountType == "credit" ? transaction.Amount : -transaction.Amount;
                    restoredBalanceAfter = wallet.CurrentBalance;
                    wallet.UpdatedAt = DateTime.UtcNow;
                }
            }
            else if (transaction.WalletType == "user" && transaction.UserWalletId.HasValue)
            {
                var wallet = await _context.UserWallets.FindAsync(transaction.UserWalletId.Value);
                if (wallet != null && !wallet.IsDeleted)
                {
                    restoredBalanceBefore = wallet.CurrentBalance;
                    // Restore: reapply the original transaction
                    wallet.CurrentBalance += transaction.AmountType == "credit" ? transaction.Amount : -transaction.Amount;
                    restoredBalanceAfter = wallet.CurrentBalance;
                    wallet.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Restore original transaction
            transaction.IsDeleted = false;
            transaction.DeletedAt = null;
            transaction.DeletedBy = null;
            transaction.Status = "completed";
            transaction.UpdatedAt = DateTime.UtcNow;
            transaction.UpdatedBy = User.GetSystemUserId();

            // Delete the reversal transaction if it exists
            if (reversalTransaction != null)
            {
                reversalTransaction.IsDeleted = true;
                reversalTransaction.DeletedAt = DateTime.UtcNow;
                reversalTransaction.DeletedBy = User.GetSystemUserId();
            }

            // Create history record for restoration
            var restorationHistory = new WalletHistory
            {
                WalletType = transaction.WalletType,
                CustomWalletId = transaction.CustomWalletId,
                UserWalletId = transaction.UserWalletId,
                UserId = transaction.UserId,
                TransactionType = transaction.TransactionType,
                AmountType = transaction.AmountType,
                Amount = transaction.Amount,
                BalanceBefore = restoredBalanceBefore,
                BalanceAfter = restoredBalanceAfter,
                Description = $"Restoration of transaction #{transaction.Id}",
                Reason = "Transaction restored",
                Reference = transaction.Reference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _context.WalletHistories.Add(restorationHistory);

            await _context.SaveChangesAsync();

            // Create transaction history entry for restoration
            var transactionHistory = new TransactionHistory
            {
                TransactionId = transaction.Id,
                Action = "Restored",
                Changes = System.Text.Json.JsonSerializer.Serialize(new
                {
                    balanceBefore = restoredBalanceBefore,
                    balanceAfter = restoredBalanceAfter,
                    reversalTransactionId = reversalTransaction?.Id
                }),
                PerformedBy = User.Identity?.Name ?? "system",
                PerformedAt = DateTime.UtcNow
            };
            _context.TransactionHistories.Add(transactionHistory);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Transaction restored successfully",
                transactionId = transaction.Id,
                balanceAfter = restoredBalanceAfter
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring transaction");
            return StatusCode(500, new { error = "An error occurred while restoring the transaction" });
        }
    }

    // POST: api/transactions/bulk-delete
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDeleteTransactions([FromBody] BulkDeleteRequest request)
    {
        try
        {
            if (request.Ids == null || !request.Ids.Any())
            {
                return BadRequest(new { error = "No transaction IDs provided" });
            }

            var deleteReason = request.Reason ?? "Bulk transaction deletion";
            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";
            var results = new List<object>();
            var errors = new List<string>();

            foreach (var id in request.Ids)
            {
                try
                {
                    var transaction = await _context.Transactions
                        .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);

                    if (transaction == null)
                    {
                        errors.Add($"Transaction {id} not found or already deleted");
                        continue;
                    }

                    if (transaction.Status == "reversed")
                    {
                        errors.Add($"Transaction {id} already reversed");
                        continue;
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
                            wallet.CurrentBalance += transaction.AmountType == "credit" ? -transaction.Amount : transaction.Amount;
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
                            wallet.CurrentBalance += transaction.AmountType == "credit" ? -transaction.Amount : transaction.Amount;
                            reversedBalanceAfter = wallet.CurrentBalance;
                            wallet.UpdatedAt = DateTime.UtcNow;
                        }
                    }

                    transaction.Status = "reversed";
                    transaction.UpdatedAt = DateTime.UtcNow;
                    transaction.UpdatedBy = User.GetSystemUserId();

                    // Create reversal transaction
                    var reversalTransaction = new Models.Transaction
                    {
                        WalletType = transaction.WalletType,
                        CustomWalletId = transaction.CustomWalletId,
                        UserWalletId = transaction.UserWalletId,
                        UserId = transaction.UserId,
                        TransactionType = transaction.TransactionType,
                        AmountType = transaction.AmountType == "credit" ? "debit" : "credit",
                        Amount = transaction.Amount,
                        Status = "completed",
                        BalanceBefore = reversedBalanceBefore,
                        BalanceAfter = reversedBalanceAfter,
                        Description = $"Reversal of transaction #{transaction.Id}",
                        Reason = deleteReason,
                        Reference = transaction.Reference,
                        RelatedTransactionId = transaction.Id,
                        IsDeleted = true,
                        DeletedAt = DateTime.UtcNow,
                        DeletedBy = User.GetSystemUserId(),
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId()
                    };

                    _context.Transactions.Add(reversalTransaction);

                    transaction.IsDeleted = true;
                    transaction.DeletedAt = DateTime.UtcNow;
                    transaction.DeletedBy = User.GetSystemUserId();

                    var deletionHistory = new TransactionHistory
                    {
                        TransactionId = transaction.Id,
                        Action = "Deleted",
                        Changes = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            reason = deleteReason,
                            reversalTransactionId = reversalTransaction.Id,
                            balanceAfterReversal = reversedBalanceAfter
                        }),
                        PerformedBy = userEmail,
                        PerformedAt = DateTime.UtcNow
                    };
                    _context.TransactionHistories.Add(deletionHistory);

                    results.Add(new { id, success = true });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error deleting transaction {id}");
                    errors.Add($"Error deleting transaction {id}: {ex.Message}");
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Processed {results.Count} transactions",
                results,
                errors
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk deleting transactions");
            return StatusCode(500, new { error = "An error occurred while bulk deleting transactions" });
        }
    }

    // POST: api/transactions/bulk-restore
    [HttpPost("bulk-restore")]
    public async Task<IActionResult> BulkRestoreTransactions([FromBody] BulkRestoreRequest request)
    {
        try
        {
            if (request.Ids == null || !request.Ids.Any())
            {
                return BadRequest(new { error = "No transaction IDs provided" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";
            var results = new List<object>();
            var errors = new List<string>();

            foreach (var id in request.Ids)
            {
                try
                {
                    var anyTransaction = await _context.Transactions
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(t => t.Id == id);

                    if (anyTransaction == null)
                    {
                        errors.Add($"Transaction {id} not found");
                        continue;
                    }

                    if (!anyTransaction.IsDeleted)
                    {
                        errors.Add($"Transaction {id} is not deleted");
                        continue;
                    }

                    var transaction = anyTransaction;

                    var reversalTransaction = await _context.Transactions
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(t => t.RelatedTransactionId == id && t.IsDeleted);

                    // Restore the balance
                    decimal restoredBalanceBefore = 0;
                    decimal restoredBalanceAfter = 0;

                    if (transaction.WalletType == "custom" && transaction.CustomWalletId.HasValue)
                    {
                        var wallet = await _context.CustomWallets.FindAsync(transaction.CustomWalletId.Value);
                        if (wallet != null && !wallet.IsDeleted)
                        {
                            restoredBalanceBefore = wallet.CurrentBalance;
                            wallet.CurrentBalance += transaction.AmountType == "credit" ? transaction.Amount : -transaction.Amount;
                            restoredBalanceAfter = wallet.CurrentBalance;
                            wallet.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                    else if (transaction.WalletType == "user" && transaction.UserWalletId.HasValue)
                    {
                        var wallet = await _context.UserWallets.FindAsync(transaction.UserWalletId.Value);
                        if (wallet != null && !wallet.IsDeleted)
                        {
                            restoredBalanceBefore = wallet.CurrentBalance;
                            wallet.CurrentBalance += transaction.AmountType == "credit" ? transaction.Amount : -transaction.Amount;
                            restoredBalanceAfter = wallet.CurrentBalance;
                            wallet.UpdatedAt = DateTime.UtcNow;
                        }
                    }

                    transaction.IsDeleted = false;
                    transaction.DeletedAt = null;
                    transaction.DeletedBy = null;
                    transaction.Status = "completed";
                    transaction.UpdatedAt = DateTime.UtcNow;
                    transaction.UpdatedBy = User.GetSystemUserId();

                    if (reversalTransaction != null)
                    {
                        reversalTransaction.IsDeleted = true;
                        reversalTransaction.DeletedAt = DateTime.UtcNow;
                        reversalTransaction.DeletedBy = User.GetSystemUserId();
                    }

                    var transactionHistory = new TransactionHistory
                    {
                        TransactionId = transaction.Id,
                        Action = "Restored",
                        Changes = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            balanceBefore = restoredBalanceBefore,
                            balanceAfter = restoredBalanceAfter,
                            reversalTransactionId = reversalTransaction?.Id
                        }),
                        PerformedBy = userEmail,
                        PerformedAt = DateTime.UtcNow
                    };
                    _context.TransactionHistories.Add(transactionHistory);

                    results.Add(new { id, success = true });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error restoring transaction {id}");
                    errors.Add($"Error restoring transaction {id}: {ex.Message}");
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Processed {results.Count} transactions",
                results,
                errors
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk restoring transactions");
            return StatusCode(500, new { error = "An error occurred while bulk restoring transactions" });
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
            var totalCredit = await query.Where(t => t.AmountType == "credit").SumAsync(t => t.Amount);
            var totalDebit = await query.Where(t => t.AmountType == "debit").SumAsync(t => t.Amount);

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

    // GET: api/transactions/{id}/comments
    [HttpGet("{id}/comments")]
    public async Task<ActionResult<object>> GetComments(int id)
    {
        try
        {
            var transaction = await _context.Transactions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null)
            {
                return NotFound(new { error = "Transaction not found" });
            }

            var comments = await _context.TransactionComments
                .Where(c => c.TransactionId == id)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Comment,
                    c.Tags,
                    c.Attachments,
                    c.CreatedBy,
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(new { data = comments, totalCount = comments.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error retrieving comments for transaction {id}");
            return StatusCode(500, new { error = "An error occurred while retrieving comments" });
        }
    }

    // POST: api/transactions/{id}/comments
    [HttpPost("{id}/comments")]
    public async Task<ActionResult<object>> AddComment(int id, [FromBody] AddCommentRequest request)
    {
        try
        {
            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";
            
            var transaction = await _context.Transactions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null)
            {
                return NotFound(new { error = "Transaction not found" });
            }

            if (string.IsNullOrWhiteSpace(request.Comment))
            {
                return BadRequest(new { error = "Comment is required" });
            }

            var comment = new TransactionComment
            {
                TransactionId = id,
                Comment = request.Comment,
                Tags = request.Tags != null && request.Tags.Any() ? System.Text.Json.JsonSerializer.Serialize(request.Tags) : null,
                Attachments = request.Attachments != null && request.Attachments.Any() ? System.Text.Json.JsonSerializer.Serialize(request.Attachments) : null,
                CreatedBy = User.GetSystemUserId(),
                CreatedAt = DateTime.UtcNow
            };

            _context.TransactionComments.Add(comment);

            // Create history entry for comment
            var commentHistory = new TransactionHistory
            {
                TransactionId = id,
                Action = "Comment Added",
                Changes = System.Text.Json.JsonSerializer.Serialize(new
                {
                    comment = request.Comment,
                    tags = request.Tags,
                    hasAttachments = request.Attachments?.Any() ?? false
                }),
                PerformedBy = userEmail,
                PerformedAt = DateTime.UtcNow
            };
            _context.TransactionHistories.Add(commentHistory);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = comment.Id,
                comment = comment.Comment,
                tags = comment.Tags,
                attachments = comment.Attachments,
                createdBy = comment.CreatedBy,
                createdAt = comment.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error adding comment to transaction {id}");
            return StatusCode(500, new { error = "An error occurred while adding comment" });
        }
    }

    // GET: api/transactions/{id}/history
    [HttpGet("{id}/history")]
    public async Task<ActionResult<object>> GetHistory(int id)
    {
        try
        {
            var transaction = await _context.Transactions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null)
            {
                return NotFound(new { error = "Transaction not found" });
            }

            var history = await _context.TransactionHistories
                .Where(h => h.TransactionId == id)
                .OrderByDescending(h => h.PerformedAt)
                .Select(h => new
                {
                    h.Id,
                    h.Action,
                    h.Changes,
                    h.PerformedBy,
                    h.PerformedAt
                })
                .ToListAsync();

            return Ok(new { data = history, totalCount = history.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error retrieving history for transaction {id}");
            return StatusCode(500, new { error = "An error occurred while retrieving history" });
        }
    }
}

public class AddCommentRequest
{
    public string Comment { get; set; } = null!;
    public List<string>? Tags { get; set; }
    public List<string>? Attachments { get; set; }
}
