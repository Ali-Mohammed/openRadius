using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;
using Backend.Helpers;

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
    
    // Custom Cashback Settings
    public bool UsesCustomCashbackSetting { get; set; } = false;
    public string? CustomCashbackType { get; set; }
    public string? CustomCashbackCollectionSchedule { get; set; }
    public decimal? CustomCashbackMinimumCollectionAmount { get; set; }
    public bool? CustomCashbackRequiresApproval { get; set; }
}

public class UpdateUserWalletRequest
{
    public decimal CurrentBalance { get; set; }
    public decimal? MaxFillLimit { get; set; }
    public decimal? DailySpendingLimit { get; set; }
    public string Status { get; set; } = "active";
    public bool? AllowNegativeBalance { get; set; }
    
    // Custom Cashback Settings
    public bool? UsesCustomCashbackSetting { get; set; }
    public string? CustomCashbackType { get; set; }
    public string? CustomCashbackCollectionSchedule { get; set; }
    public decimal? CustomCashbackMinimumCollectionAmount { get; set; }
    public bool? CustomCashbackRequiresApproval { get; set; }
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
                query = query.Where(uw => uw.Status.ToLower() == status.ToLower());
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(uw => 
                    uw.CustomWallet != null && uw.CustomWallet.Name.Contains(search));
            }

            var totalCount = await query.CountAsync();

            // Get user IDs to fetch user details from master DB
            var userWallets = await query
                .OrderByDescending(uw => uw.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = userWallets.Select(uw => uw.UserId).Distinct().ToList();
            var walletIds = userWallets.Select(uw => uw.Id).ToList();
            
            _logger.LogDebug("Fetching user details for {UserCount} users", userIds.Count);
            var users = await _masterContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName })
                .ToListAsync();

            // Fetch cashback group memberships for users
            var cashbackGroupUsers = await _context.CashbackGroupUsers
                .Include(cgu => cgu.CashbackGroup)
                .Where(cgu => userIds.Contains(cgu.UserId) && !cgu.CashbackGroup.Disabled)
                .Select(cgu => new { cgu.UserId, CashbackGroupName = cgu.CashbackGroup.Name, CashbackGroupId = cgu.CashbackGroup.Id })
                .ToListAsync();

            // Calculate pending cashback for each wallet (by UserWalletId or UserId)
            // Enterprise optimization: Uses composite index on (WalletType, TransactionType, CashbackStatus, DeletedAt)
            _logger.LogDebug("Calculating pending cashback for {WalletCount} wallets", walletIds.Count);
            var pendingCashbackByWallet = await _context.Transactions
                .Where(t => 
                    ((t.UserWalletId != null && walletIds.Contains(t.UserWalletId.Value)) ||
                     (t.UserId != null && userIds.Contains(t.UserId.Value))) &&
                    t.WalletType == "user" &&
                    t.TransactionType == TransactionType.Cashback &&
                    (t.CashbackStatus == "Pending" || t.CashbackStatus == "WaitingForApproval") &&
                    t.DeletedAt == null)
                .ToListAsync();
            
            _logger.LogDebug("Found {PendingCount} pending cashback transactions", pendingCashbackByWallet.Count);

            var result = userWallets.Select(uw =>
            {
                var user = users.FirstOrDefault(u => u.Id == uw.UserId);
                var cashbackGroup = cashbackGroupUsers.FirstOrDefault(cgu => cgu.UserId == uw.UserId);
                // Sum pending cashback for this wallet (either by UserWalletId or UserId match)
                var pendingCashback = pendingCashbackByWallet
                    .Where(t => (t.UserWalletId == uw.Id) || (t.UserId == uw.UserId))
                    .Sum(t => t.Amount);
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
                    PendingCashback = pendingCashback,
                    // Cashback Group
                    CashbackGroupId = cashbackGroup?.CashbackGroupId,
                    CashbackGroupName = cashbackGroup?.CashbackGroupName,
                    // Custom Cashback Settings
                    uw.UsesCustomCashbackSetting,
                    uw.CustomCashbackType,
                    uw.CustomCashbackCollectionSchedule,
                    uw.CustomCashbackMinimumCollectionAmount,
                    uw.CustomCashbackRequiresApproval,
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

            var cashbackGroup = await _context.CashbackGroupUsers
                .Include(cgu => cgu.CashbackGroup)
                .Where(cgu => cgu.UserId == userWallet.UserId && !cgu.CashbackGroup.Disabled)
                .Select(cgu => new { CashbackGroupName = cgu.CashbackGroup.Name, CashbackGroupId = cgu.CashbackGroup.Id })
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
                // Cashback Group
                CashbackGroupId = cashbackGroup?.CashbackGroupId,
                CashbackGroupName = cashbackGroup?.CashbackGroupName,
                // Custom Cashback Settings
                userWallet.UsesCustomCashbackSetting,
                userWallet.CustomCashbackType,
                userWallet.CustomCashbackCollectionSchedule,
                userWallet.CustomCashbackMinimumCollectionAmount,
                userWallet.CustomCashbackRequiresApproval,
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
                UsesCustomCashbackSetting = request.UsesCustomCashbackSetting,
                CustomCashbackType = request.CustomCashbackType,
                CustomCashbackCollectionSchedule = request.CustomCashbackCollectionSchedule,
                CustomCashbackMinimumCollectionAmount = request.CustomCashbackMinimumCollectionAmount,
                CustomCashbackRequiresApproval = request.CustomCashbackRequiresApproval,
                CreatedBy = User.GetSystemUserId(),
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
                    userWallet.UsesCustomCashbackSetting,
                    userWallet.CustomCashbackType,
                    userWallet.CustomCashbackCollectionSchedule,
                    userWallet.CustomCashbackMinimumCollectionAmount,
                    userWallet.CustomCashbackRequiresApproval,
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
            
            // Update custom cashback settings if provided
            if (request.UsesCustomCashbackSetting.HasValue)
            {
                existingWallet.UsesCustomCashbackSetting = request.UsesCustomCashbackSetting.Value;
            }
            if (request.CustomCashbackType != null)
            {
                existingWallet.CustomCashbackType = request.CustomCashbackType;
            }
            if (request.CustomCashbackCollectionSchedule != null)
            {
                existingWallet.CustomCashbackCollectionSchedule = request.CustomCashbackCollectionSchedule;
            }
            if (request.CustomCashbackMinimumCollectionAmount.HasValue)
            {
                existingWallet.CustomCashbackMinimumCollectionAmount = request.CustomCashbackMinimumCollectionAmount;
            }
            if (request.CustomCashbackRequiresApproval.HasValue)
            {
                existingWallet.CustomCashbackRequiresApproval = request.CustomCashbackRequiresApproval;
            }
            
            existingWallet.UpdatedAt = DateTime.UtcNow;
            existingWallet.UpdatedBy = User.GetSystemUserId();

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
            userWallet.DeletedBy = User.GetSystemUserId();

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user wallet");
            return StatusCode(500, new { error = "An error occurred while deleting the user wallet" });
        }
    }

    // GET: api/user-wallets/my-wallet
    [HttpGet("my-wallet")]
    public async Task<ActionResult<object>> GetMyWallet()
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            // Get current user from master database
            var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (currentUser == null)
            {
                return NotFound(new { error = "Current user not found" });
            }

            // Get user's wallet
            var userWallet = await _context.UserWallets
                .Include(uw => uw.CustomWallet)
                .FirstOrDefaultAsync(uw => uw.UserId == currentUser.Id && !uw.IsDeleted);

            if (userWallet == null)
            {
                return Ok(new { hasWallet = false, message = "No wallet found for current user" });
            }

            return Ok(new
            {
                hasWallet = true,
                id = userWallet.Id,
                userId = userWallet.UserId,
                userName = !string.IsNullOrEmpty(currentUser.FirstName) || !string.IsNullOrEmpty(currentUser.LastName) 
                    ? $"{currentUser.FirstName} {currentUser.LastName}".Trim() 
                    : currentUser.Email,
                customWalletId = userWallet.CustomWalletId,
                customWalletName = userWallet.CustomWallet?.Name,
                currentBalance = userWallet.CurrentBalance,
                status = userWallet.Status,
                allowNegativeBalance = userWallet.AllowNegativeBalance ?? userWallet.CustomWallet?.AllowNegativeBalance ?? false
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user's wallet");
            return StatusCode(500, new { error = "An error occurred while retrieving your wallet" });
        }
    }
}
