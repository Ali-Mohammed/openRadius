using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/custom-wallets")]
[Authorize]
public class CustomWalletController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CustomWalletController> _logger;

    public CustomWalletController(ApplicationDbContext context, ILogger<CustomWalletController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/custom-wallets
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetCustomWallets(
        [FromQuery] string? search = null,
        [FromQuery] string? type = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.CustomWallets.AsQueryable();

            // Apply filters
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(w => 
                    w.Name.Contains(search) || 
                    (w.Description != null && w.Description.Contains(search)));
            }

            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(w => w.Type == type);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(w => w.Status == status);
            }

            var totalCount = await query.CountAsync();
            
            var wallets = await query
                .OrderBy(w => w.SortOrder)
                .ThenByDescending(w => w.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(w => new
                {
                    w.Id,
                    w.Name,
                    w.Description,
                    w.MaxFillLimit,
                    w.DailySpendingLimit,
                    w.Type,
                    w.Status,
                    w.Color,
                    w.Icon,
                    w.CurrentBalance,
                    w.AllowNegativeBalance,
                    w.SortOrder,
                    w.CreatedAt,
                    w.UpdatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                data = wallets,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching wallets");
            return StatusCode(500, new { error = "Failed to fetch wallets", message = ex.Message });
        }
    }

    // GET: api/custom-wallets/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<CustomWallet>> GetCustomWallet(int id)
    {
        try
        {
            var wallet = await _context.CustomWallets.FindAsync(id);

            if (wallet == null)
            {
                return NotFound(new { error = "Custom wallet not found" });
            }

            return Ok(wallet);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching wallet {WalletId}", id);
            return StatusCode(500, new { error = "Failed to fetch wallet", message = ex.Message });
        }
    }

    // POST: api/custom-wallets
    [HttpPost]
    public async Task<ActionResult<CustomWallet>> CreateCustomWallet([FromBody] CustomWallet wallet)
    {
        try
        {
            // Check for duplicate name
            var nameExists = await _context.CustomWallets
                .AnyAsync(w => w.Name.ToLower() == wallet.Name.ToLower());
            
            if (nameExists)
            {
                return BadRequest(new { error = "A custom wallet with this name already exists" });
            }

            // Set sort order to be last
            var maxSortOrder = await _context.CustomWallets.MaxAsync(w => (int?)w.SortOrder) ?? -1;
            wallet.SortOrder = maxSortOrder + 1;

            wallet.CreatedAt = DateTime.UtcNow;
            wallet.CurrentBalance = 0;

            _context.CustomWallets.Add(wallet);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created custom wallet: {WalletName} (ID: {WalletId})", wallet.Name, wallet.Id);

            return CreatedAtAction(nameof(GetCustomWallet), new { id = wallet.Id }, wallet);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating wallet");
            return StatusCode(500, new { error = "Failed to create wallet", message = ex.Message });
        }
    }

    // PUT: api/custom-wallets/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCustomWallet(int id, [FromBody] CustomWallet wallet)
    {
        if (id != wallet.Id)
        {
            return BadRequest(new { error = "Custom wallet ID mismatch" });
        }

        try
        {
            var existingWallet = await _context.CustomWallets.FindAsync(id);

            if (existingWallet == null)
            {
                return NotFound(new { error = "Custom wallet not found" });
            }

            // Check for duplicate name (excluding current wallet)
            var nameExists = await _context.CustomWallets
                .AnyAsync(w => w.Id != id && w.Name.ToLower() == wallet.Name.ToLower());
            
            if (nameExists)
            {
                return BadRequest(new { error = "A custom wallet with this name already exists" });
            }

            existingWallet.Name = wallet.Name;
            existingWallet.Description = wallet.Description;
            existingWallet.MaxFillLimit = wallet.MaxFillLimit;
            existingWallet.DailySpendingLimit = wallet.DailySpendingLimit;
            existingWallet.Type = wallet.Type;
            existingWallet.Status = wallet.Status;
            existingWallet.Color = wallet.Color;
            existingWallet.Icon = wallet.Icon;
            existingWallet.AllowNegativeBalance = wallet.AllowNegativeBalance;
            existingWallet.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated wallet: {WalletName} (ID: {WalletId})", wallet.Name, wallet.Id);

            return Ok(existingWallet);
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await CustomWalletExists(id))
            {
                return NotFound(new { error = "Custom wallet not found" });
            }
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating wallet {WalletId}", id);
            return StatusCode(500, new { error = "Failed to update wallet", message = ex.Message });
        }
    }

    // DELETE: api/custom-wallets/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCustomWallet(int id)
    {
        try
        {
            var wallet = await _context.CustomWallets.FindAsync(id);

            if (wallet == null)
            {
                return NotFound(new { error = "Custom wallet not found" });
            }

            // Soft delete
            wallet.IsDeleted = true;
            wallet.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted wallet: {WalletName} (ID: {WalletId})", wallet.Name, wallet.Id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting wallet {WalletId}", id);
            return StatusCode(500, new { error = "Failed to delete wallet", message = ex.Message });
        }
    }

    // GET: api/custom-wallets/types
    [HttpGet("types")]
    public ActionResult<IEnumerable<object>> GetCustomWalletTypes()
    {
        var types = new[]
        {
            new { value = "spending", label = "Spending Wallet", description = "For regular spending and purchases", icon = "CreditCard", color = "#ef4444" },
            new { value = "collection", label = "Collection Wallet", description = "For collecting payments and revenue", icon = "Wallet", color = "#10b981" },
            new { value = "credit", label = "Credit Wallet", description = "For credit line and borrowing", icon = "TrendingUp", color = "#3b82f6" },
            new { value = "prepaid", label = "Prepaid Wallet", description = "For prepaid balance and top-ups", icon = "DollarSign", color = "#f59e0b" },
            new { value = "reward", label = "Reward Wallet", description = "For rewards, points, and bonuses", icon = "Gift", color = "#8b5cf6" }
        };

        return Ok(types);
    }

    // GET: api/custom-wallets/statuses
    [HttpGet("statuses")]
    public ActionResult<IEnumerable<object>> GetCustomWalletStatuses()
    {
        var statuses = new[]
        {
            new { value = "active", label = "Active", color = "#10b981" },
            new { value = "disabled", label = "Disabled", color = "#6b7280" },
            new { value = "suspended", label = "Suspended", color = "#f59e0b" }
        };

        return Ok(statuses);
    }

    // POST: api/custom-wallets/reorder
    [HttpPost("reorder")]
    public async Task<IActionResult> ReorderCustomWallets([FromBody] List<WalletSortOrder> sortOrders)
    {
        try
        {
            _logger.LogInformation("Reorder request received with {Count} items", sortOrders?.Count ?? 0);
            
            if (sortOrders == null || sortOrders.Count == 0)
            {
                return BadRequest(new { error = "No sort orders provided" });
            }

            foreach (var item in sortOrders)
            {
                var wallet = await _context.CustomWallets.FindAsync(item.Id);
                if (wallet != null)
                {
                    wallet.SortOrder = item.SortOrder;
                    _logger.LogDebug("Updated wallet {Id} sort order to {SortOrder}", item.Id, item.SortOrder);
                }
                else
                {
                    _logger.LogWarning("Wallet {Id} not found during reorder", item.Id);
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Updated sort order for {Count} wallets", sortOrders.Count);

            return Ok(new { message = "Sort order updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating wallet sort order");
            return StatusCode(500, new { error = "Failed to update sort order", message = ex.Message });
        }
    }

    private async Task<bool> CustomWalletExists(int id)
    {
        return await _context.CustomWallets.AnyAsync(e => e.Id == id);
    }
}

public class WalletSortOrder
{
    public int Id { get; set; }
    public Guid Uuid { get; set; }
    public int SortOrder { get; set; }
}
