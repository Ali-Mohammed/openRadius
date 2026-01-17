using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RadiusActivationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<RadiusActivationController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public RadiusActivationController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        ILogger<RadiusActivationController> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _masterContext = masterContext;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // GET: api/RadiusActivation
    [HttpGet]
    public async Task<ActionResult<object>> GetActivations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? type = null,
        [FromQuery] string? status = null,
        [FromQuery] string? apiStatus = null,
        [FromQuery] int? radiusUserId = null,
        [FromQuery] int? radiusProfileId = null,
        [FromQuery] int? billingProfileId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] bool includeDeleted = false)
    {
        try
        {
            var query = includeDeleted 
                ? _context.RadiusActivations.IgnoreQueryFilters()
                : _context.RadiusActivations.AsQueryable();

            // Apply filters
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(a => 
                    (a.RadiusUsername != null && a.RadiusUsername.Contains(search)) ||
                    (a.ActionByUsername != null && a.ActionByUsername.Contains(search)) ||
                    (a.ActionForUsername != null && a.ActionForUsername.Contains(search)) ||
                    (a.ExternalReferenceId != null && a.ExternalReferenceId.Contains(search)) ||
                    (a.Notes != null && a.Notes.Contains(search)));
            }

            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(a => a.Type == type);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(a => a.Status == status);
            }

            if (!string.IsNullOrEmpty(apiStatus))
            {
                query = query.Where(a => a.ApiStatus == apiStatus);
            }

            if (radiusUserId.HasValue)
            {
                query = query.Where(a => a.RadiusUserId == radiusUserId.Value);
            }

            if (radiusProfileId.HasValue)
            {
                query = query.Where(a => a.RadiusProfileId == radiusProfileId.Value);
            }

            if (billingProfileId.HasValue)
            {
                query = query.Where(a => a.BillingProfileId == billingProfileId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt <= endDate.Value);
            }

            // Apply sorting
            query = sortField?.ToLower() switch
            {
                "radiususername" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.RadiusUsername) 
                    : query.OrderByDescending(a => a.RadiusUsername),
                "type" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.Type) 
                    : query.OrderByDescending(a => a.Type),
                "status" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.Status) 
                    : query.OrderByDescending(a => a.Status),
                "apistatus" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.ApiStatus) 
                    : query.OrderByDescending(a => a.ApiStatus),
                "amount" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.Amount) 
                    : query.OrderByDescending(a => a.Amount),
                "currentexpiredate" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.CurrentExpireDate) 
                    : query.OrderByDescending(a => a.CurrentExpireDate),
                "createdat" => sortDirection == "asc" 
                    ? query.OrderBy(a => a.CreatedAt) 
                    : query.OrderByDescending(a => a.CreatedAt),
                _ => query.OrderByDescending(a => a.CreatedAt)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var activations = await query
                .Include(a => a.RadiusUser)
                .Include(a => a.RadiusProfile)
                .Include(a => a.PreviousRadiusProfile)
                .Include(a => a.BillingProfile)
                .Include(a => a.PreviousBillingProfile)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new RadiusActivationResponse
                {
                    Id = a.Id,
                    ActionById = a.ActionById,
                    ActionByUsername = a.ActionByUsername,
                    ActionForId = a.ActionForId,
                    ActionForUsername = a.ActionForUsername,
                    IsActionBehalf = a.IsActionBehalf,
                    RadiusUserId = a.RadiusUserId,
                    RadiusUsername = a.RadiusUsername ?? a.RadiusUser!.Username,
                    PreviousRadiusProfileId = a.PreviousRadiusProfileId,
                    PreviousRadiusProfileName = a.PreviousRadiusProfile != null ? a.PreviousRadiusProfile.Name : null,
                    RadiusProfileId = a.RadiusProfileId,
                    RadiusProfileName = a.RadiusProfile != null ? a.RadiusProfile.Name : null,
                    PreviousBillingProfileId = a.PreviousBillingProfileId,
                    PreviousBillingProfileName = a.PreviousBillingProfile != null ? a.PreviousBillingProfile.Name : null,
                    BillingProfileId = a.BillingProfileId,
                    BillingProfileName = a.BillingProfile != null ? a.BillingProfile.Name : null,
                    PreviousExpireDate = a.PreviousExpireDate,
                    CurrentExpireDate = a.CurrentExpireDate,
                    NextExpireDate = a.NextExpireDate,
                    PreviousBalance = a.PreviousBalance,
                    NewBalance = a.NewBalance,
                    Amount = a.Amount,
                    Type = a.Type,
                    Status = a.Status,
                    ApiStatus = a.ApiStatus,
                    ApiStatusCode = a.ApiStatusCode,
                    ApiStatusMessage = a.ApiStatusMessage,
                    ExternalReferenceId = a.ExternalReferenceId,
                    TransactionId = a.TransactionId,
                    PaymentMethod = a.PaymentMethod,
                    DurationDays = a.DurationDays,
                    Source = a.Source,
                    IpAddress = a.IpAddress,
                    Notes = a.Notes,
                    RetryCount = a.RetryCount,
                    ProcessingStartedAt = a.ProcessingStartedAt,
                    ProcessingCompletedAt = a.ProcessingCompletedAt,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                data = activations,
                page,
                pageSize,
                totalCount,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching activations");
            return StatusCode(500, new { error = "An error occurred while fetching activations" });
        }
    }

    // GET: api/RadiusActivation/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusActivationResponse>> GetActivation(int id)
    {
        try
        {
            var activation = await _context.RadiusActivations
                .Include(a => a.RadiusUser)
                .Include(a => a.RadiusProfile)
                .Include(a => a.PreviousRadiusProfile)
                .Include(a => a.BillingProfile)
                .Include(a => a.PreviousBillingProfile)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (activation == null)
            {
                return NotFound(new { error = "Activation not found" });
            }

            return Ok(new RadiusActivationResponse
            {
                Id = activation.Id,
                ActionById = activation.ActionById,
                ActionByUsername = activation.ActionByUsername,
                ActionForId = activation.ActionForId,
                ActionForUsername = activation.ActionForUsername,
                IsActionBehalf = activation.IsActionBehalf,
                RadiusUserId = activation.RadiusUserId,
                RadiusUsername = activation.RadiusUsername ?? activation.RadiusUser?.Username,
                PreviousRadiusProfileId = activation.PreviousRadiusProfileId,
                PreviousRadiusProfileName = activation.PreviousRadiusProfile?.Name,
                RadiusProfileId = activation.RadiusProfileId,
                RadiusProfileName = activation.RadiusProfile?.Name,
                PreviousBillingProfileId = activation.PreviousBillingProfileId,
                PreviousBillingProfileName = activation.PreviousBillingProfile?.Name,
                BillingProfileId = activation.BillingProfileId,
                BillingProfileName = activation.BillingProfile?.Name,
                PreviousExpireDate = activation.PreviousExpireDate,
                CurrentExpireDate = activation.CurrentExpireDate,
                NextExpireDate = activation.NextExpireDate,
                PreviousBalance = activation.PreviousBalance,
                NewBalance = activation.NewBalance,
                Amount = activation.Amount,
                Type = activation.Type,
                Status = activation.Status,
                ApiStatus = activation.ApiStatus,
                ApiStatusCode = activation.ApiStatusCode,
                ApiStatusMessage = activation.ApiStatusMessage,
                ExternalReferenceId = activation.ExternalReferenceId,
                TransactionId = activation.TransactionId,
                PaymentMethod = activation.PaymentMethod,
                DurationDays = activation.DurationDays,
                Source = activation.Source,
                IpAddress = activation.IpAddress,
                Notes = activation.Notes,
                RetryCount = activation.RetryCount,
                ProcessingStartedAt = activation.ProcessingStartedAt,
                ProcessingCompletedAt = activation.ProcessingCompletedAt,
                CreatedAt = activation.CreatedAt,
                UpdatedAt = activation.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching activation {id}");
            return StatusCode(500, new { error = "An error occurred while fetching the activation" });
        }
    }

    // GET: api/RadiusActivation/user/{radiusUserId}
    [HttpGet("user/{radiusUserId}")]
    public async Task<ActionResult<IEnumerable<RadiusActivationResponse>>> GetUserActivations(
        int radiusUserId,
        [FromQuery] int limit = 50)
    {
        try
        {
            var activations = await _context.RadiusActivations
                .Where(a => a.RadiusUserId == radiusUserId)
                .OrderByDescending(a => a.CreatedAt)
                .Take(limit)
                .Include(a => a.RadiusProfile)
                .Include(a => a.BillingProfile)
                .Select(a => new RadiusActivationResponse
                {
                    Id = a.Id,
                    ActionByUsername = a.ActionByUsername,
                    IsActionBehalf = a.IsActionBehalf,
                    RadiusUserId = a.RadiusUserId,
                    RadiusUsername = a.RadiusUsername,
                    RadiusProfileId = a.RadiusProfileId,
                    RadiusProfileName = a.RadiusProfile != null ? a.RadiusProfile.Name : null,
                    BillingProfileId = a.BillingProfileId,
                    BillingProfileName = a.BillingProfile != null ? a.BillingProfile.Name : null,
                    PreviousExpireDate = a.PreviousExpireDate,
                    CurrentExpireDate = a.CurrentExpireDate,
                    Amount = a.Amount,
                    Type = a.Type,
                    Status = a.Status,
                    ApiStatus = a.ApiStatus,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(activations);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching activations for user {radiusUserId}");
            return StatusCode(500, new { error = "An error occurred while fetching user activations" });
        }
    }

    // POST: api/RadiusActivation
    [HttpPost]
    public async Task<ActionResult<RadiusActivationResponse>> CreateActivation([FromBody] CreateRadiusActivationRequest request)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? "system";
            var ipAddress = _httpContextAccessor.HttpContext?.Connection?.RemoteIpAddress?.ToString();
            var userAgent = _httpContextAccessor.HttpContext?.Request?.Headers["User-Agent"].ToString();

            // Get the RADIUS user
            var radiusUser = await _context.RadiusUsers.FindAsync(request.RadiusUserId);
            if (radiusUser == null)
            {
                return NotFound(new { error = "RADIUS user not found" });
            }

            // Wallet payment validation
            int? transactionId = null;
            if (request.PaymentMethod?.ToLower() == "wallet")
            {
                // Get current user ID from MasterDbContext
                var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
                if (currentUser == null)
                {
                    return BadRequest(new { error = "Current user not found" });
                }

                // Check if user has a wallet
                var userWallet = await _context.UserWallets
                    .Include(uw => uw.CustomWallet)
                    .FirstOrDefaultAsync(uw => uw.UserId == currentUser.Id && !uw.IsDeleted);

                if (userWallet == null)
                {
                    return BadRequest(new { error = "User does not have a wallet. Please create a wallet first." });
                }

                // Check if wallet status is active
                if (userWallet.Status?.ToLower() != "active")
                {
                    return BadRequest(new { error = $"User wallet is {userWallet.Status}. Only active wallets can be used for payments." });
                }

                // Check balance and validate against negative balance policy
                var activationAmount = request.Amount ?? 0;
                var balanceAfter = userWallet.CurrentBalance - activationAmount;

                // Check if wallet allows negative balance
                var allowNegative = userWallet.AllowNegativeBalance ?? userWallet.CustomWallet?.AllowNegativeBalance ?? false;
                
                if (!allowNegative && balanceAfter < 0)
                {
                    return BadRequest(new { 
                        error = $"Insufficient wallet balance. Current balance: {userWallet.CurrentBalance:F2}, Required: {activationAmount:F2}, Shortage: {Math.Abs(balanceAfter):F2}" 
                    });
                }

                // Create transaction for wallet deduction
                var balanceBefore = userWallet.CurrentBalance;
                userWallet.CurrentBalance = balanceAfter;
                userWallet.UpdatedAt = DateTime.UtcNow;
                userWallet.UpdatedBy = userEmail;

                var transaction = new Transaction
                {
                    WalletType = "user",
                    UserWalletId = userWallet.Id,
                    UserId = currentUser.Id,
                    TransactionType = TransactionType.Payment,
                    AmountType = "debit",
                    Amount = activationAmount,
                    Status = "completed",
                    BalanceBefore = balanceBefore,
                    BalanceAfter = balanceAfter,
                    Description = $"RADIUS user activation for {radiusUser.Username}",
                    Reference = $"ACTIVATION-{radiusUser.Id}",
                    PaymentMethod = "Wallet",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userEmail
                };

                _context.Transactions.Add(transaction);

                // Also create wallet history record for tracking
                var walletHistory = new WalletHistory
                {
                    WalletType = "user",
                    UserWalletId = userWallet.Id,
                    UserId = currentUser.Id,
                    TransactionType = TransactionType.Payment,
                    AmountType = "debit",
                    Amount = activationAmount,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = balanceAfter,
                    Description = $"RADIUS user activation for {radiusUser.Username}",
                    Reference = $"ACTIVATION-{radiusUser.Id}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userEmail
                };

                _context.WalletHistories.Add(walletHistory);
                await _context.SaveChangesAsync(); // Save to get transaction ID

                transactionId = transaction.Id;

                _logger.LogInformation($"Created wallet transaction {transaction.Id} and history record for activation. Balance: {balanceBefore:F2} -> {balanceAfter:F2}");
            }

            var activation = new RadiusActivation
            {
                ActionByUsername = userEmail,
                ActionForId = request.ActionForId,
                ActionForUsername = request.ActionForUsername,
                IsActionBehalf = request.IsActionBehalf,
                RadiusUserId = request.RadiusUserId,
                RadiusUsername = radiusUser.Username,
                PreviousRadiusProfileId = radiusUser.ProfileId,
                RadiusProfileId = request.RadiusProfileId ?? radiusUser.ProfileId,
                PreviousBillingProfileId = radiusUser.ProfileBillingId,
                BillingProfileId = request.BillingProfileId ?? radiusUser.ProfileBillingId,
                PreviousExpireDate = radiusUser.Expiration,
                CurrentExpireDate = radiusUser.Expiration,
                NextExpireDate = request.NextExpireDate,
                PreviousBalance = radiusUser.Balance,
                Amount = request.Amount,
                Type = request.Type,
                Status = "completed",
                PaymentMethod = request.PaymentMethod,
                TransactionId = transactionId,
                DurationDays = request.DurationDays,
                Source = request.Source ?? "web",
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow
            };

            // Calculate the next expiration date
            // If current expiration is in the past, use now + duration
            // If current expiration is in the future, use current + duration
            if (request.NextExpireDate.HasValue)
            {
                radiusUser.Expiration = request.NextExpireDate.Value;
                activation.CurrentExpireDate = request.NextExpireDate.Value;
            }
            else if (request.DurationDays.HasValue)
            {
                var now = DateTime.UtcNow;
                var baseDate = now;
                
                if (radiusUser.Expiration.HasValue && radiusUser.Expiration.Value > now)
                {
                    baseDate = radiusUser.Expiration.Value;
                }
                
                var newExpireDate = baseDate.AddDays(request.DurationDays.Value);
                radiusUser.Expiration = newExpireDate;
                activation.NextExpireDate = newExpireDate;
                activation.CurrentExpireDate = newExpireDate;
            }
            
            if (request.RadiusProfileId.HasValue)
            {
                radiusUser.ProfileId = request.RadiusProfileId.Value;
            }
            
            if (request.BillingProfileId.HasValue)
            {
                radiusUser.ProfileBillingId = request.BillingProfileId.Value;
            }
            
            radiusUser.UpdatedAt = DateTime.UtcNow;
            activation.NewBalance = radiusUser.Balance;
            activation.ProcessingStartedAt = DateTime.UtcNow;
            activation.ProcessingCompletedAt = DateTime.UtcNow;

            _context.RadiusActivations.Add(activation);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Created activation {activation.Id} for user {radiusUser.Username}, updated expiration to {radiusUser.Expiration}");

            return CreatedAtAction(nameof(GetActivation), new { id = activation.Id }, new RadiusActivationResponse
            {
                Id = activation.Id,
                ActionByUsername = activation.ActionByUsername,
                IsActionBehalf = activation.IsActionBehalf,
                RadiusUserId = activation.RadiusUserId,
                RadiusUsername = activation.RadiusUsername,
                RadiusProfileId = activation.RadiusProfileId,
                BillingProfileId = activation.BillingProfileId,
                PreviousExpireDate = activation.PreviousExpireDate,
                CurrentExpireDate = activation.CurrentExpireDate,
                NextExpireDate = activation.NextExpireDate,
                Amount = activation.Amount,
                Type = activation.Type,
                Status = activation.Status,
                Source = activation.Source,
                CreatedAt = activation.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating activation");
            return StatusCode(500, new { error = "An error occurred while creating the activation" });
        }
    }

    // PUT: api/RadiusActivation/{id}/status
    [HttpPut("{id}/status")]
    public async Task<ActionResult> UpdateActivationStatus(
        int id,
        [FromBody] UpdateActivationStatusRequest request)
    {
        try
        {
            var activation = await _context.RadiusActivations.FindAsync(id);
            if (activation == null)
            {
                return NotFound(new { error = "Activation not found" });
            }

            activation.Status = request.Status;
            activation.ApiStatus = request.ApiStatus;
            activation.ApiStatusCode = request.ApiStatusCode;
            activation.ApiStatusMessage = request.ApiStatusMessage;
            activation.ApiResponse = request.ApiResponse;
            activation.ExternalReferenceId = request.ExternalReferenceId;
            activation.UpdatedAt = DateTime.UtcNow;

            if (request.Status == "processing" && activation.ProcessingStartedAt == null)
            {
                activation.ProcessingStartedAt = DateTime.UtcNow;
            }

            if (request.Status == "completed" || request.Status == "failed")
            {
                activation.ProcessingCompletedAt = DateTime.UtcNow;
            }

            if (request.Status == "failed")
            {
                activation.RetryCount++;
                activation.LastRetryAt = DateTime.UtcNow;
            }

            if (request.NewBalance.HasValue)
            {
                activation.NewBalance = request.NewBalance;
            }

            if (request.CurrentExpireDate.HasValue)
            {
                activation.CurrentExpireDate = request.CurrentExpireDate;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Activation status updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error updating activation status {id}");
            return StatusCode(500, new { error = "An error occurred while updating the activation status" });
        }
    }

    // DELETE: api/RadiusActivation/{id}
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteActivation(int id)
    {
        try
        {
            var activation = await _context.RadiusActivations.FindAsync(id);
            if (activation == null)
            {
                return NotFound(new { error = "Activation not found" });
            }

            // Check if next expire date has passed
            if (activation.NextExpireDate.HasValue && activation.NextExpireDate.Value < DateTime.UtcNow)
            {
                return BadRequest(new { error = "Cannot delete activation - the expiration date has already passed" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";
            
            // Revert the user's expiration date to the previous value
            if (activation.RadiusUserId > 0)
            {
                var radiusUser = await _context.RadiusUsers.FindAsync(activation.RadiusUserId);
                if (radiusUser != null)
                {
                    // Restore the previous expiration date
                    radiusUser.Expiration = activation.PreviousExpireDate;
                    
                    // Restore the previous profile if it was changed
                    if (activation.PreviousRadiusProfileId.HasValue)
                    {
                        radiusUser.ProfileId = activation.PreviousRadiusProfileId.Value;
                    }
                    
                    // Restore the previous billing profile if it was changed
                    if (activation.PreviousBillingProfileId.HasValue)
                    {
                        radiusUser.ProfileBillingId = activation.PreviousBillingProfileId.Value;
                    }
                    
                    radiusUser.UpdatedAt = DateTime.UtcNow;
                    
                    _logger.LogInformation($"Reverted user {radiusUser.Username} expiration to {activation.PreviousExpireDate}");
                }
            }
            
            // Soft delete the activation
            activation.IsDeleted = true;
            activation.DeletedAt = DateTime.UtcNow;
            activation.DeletedBy = userEmail;
            activation.Status = "rolled_back";

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error deleting activation {id}");
            return StatusCode(500, new { error = "An error occurred while deleting the activation" });
        }
    }

    // POST: api/RadiusActivation/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<ActionResult> RestoreActivation(int id)
    {
        try
        {
            var activation = await _context.RadiusActivations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(a => a.Id == id);
                
            if (activation == null)
            {
                return NotFound(new { error = "Activation not found" });
            }

            if (!activation.IsDeleted)
            {
                return BadRequest(new { error = "Activation is not deleted" });
            }

            // Check if next expire date has passed
            if (activation.NextExpireDate.HasValue && activation.NextExpireDate.Value < DateTime.UtcNow)
            {
                return BadRequest(new { error = "Cannot restore activation - the expiration date has already passed" });
            }

            var userEmail = _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "system";

            // Restore the user's expiration date and profiles
            if (activation.RadiusUserId > 0)
            {
                var radiusUser = await _context.RadiusUsers.FindAsync(activation.RadiusUserId);
                if (radiusUser != null)
                {
                    // Restore the next expiration date (the one from the activation)
                    if (activation.NextExpireDate.HasValue)
                    {
                        radiusUser.Expiration = activation.NextExpireDate.Value;
                    }
                    
                    // Restore the profile from the activation
                    if (activation.RadiusProfileId.HasValue)
                    {
                        radiusUser.ProfileId = activation.RadiusProfileId.Value;
                    }
                    
                    // Restore the billing profile from the activation
                    if (activation.BillingProfileId.HasValue)
                    {
                        radiusUser.ProfileBillingId = activation.BillingProfileId.Value;
                    }
                    
                    radiusUser.UpdatedAt = DateTime.UtcNow;
                    
                    _logger.LogInformation($"Restored user {radiusUser.Username} expiration to {activation.NextExpireDate}");
                }
            }
            
            // Restore the activation
            activation.IsDeleted = false;
            activation.DeletedAt = null;
            activation.DeletedBy = null;
            activation.Status = "completed";
            activation.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Activation restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error restoring activation {id}");
            return StatusCode(500, new { error = "An error occurred while restoring the activation" });
        }
    }

    // GET: api/RadiusActivation/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedActivations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var query = _context.RadiusActivations
                .IgnoreQueryFilters()
                .Where(a => a.IsDeleted);

            var totalCount = await query.CountAsync();

            var activations = await query
                .Include(a => a.RadiusProfile)
                .Include(a => a.PreviousRadiusProfile)
                .Include(a => a.BillingProfile)
                .Include(a => a.PreviousBillingProfile)
                .OrderByDescending(a => a.DeletedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new RadiusActivationResponse
                {
                    Id = a.Id,
                    ActionByUsername = a.ActionByUsername,
                    ActionForUsername = a.ActionForUsername,
                    IsActionBehalf = a.IsActionBehalf,
                    RadiusUserId = a.RadiusUserId,
                    RadiusUsername = a.RadiusUsername,
                    PreviousRadiusProfileId = a.PreviousRadiusProfileId,
                    PreviousRadiusProfileName = a.PreviousRadiusProfile != null ? a.PreviousRadiusProfile.Name : null,
                    RadiusProfileId = a.RadiusProfileId,
                    RadiusProfileName = a.RadiusProfile != null ? a.RadiusProfile.Name : null,
                    PreviousBillingProfileId = a.PreviousBillingProfileId,
                    PreviousBillingProfileName = a.PreviousBillingProfile != null ? a.PreviousBillingProfile.Name : null,
                    BillingProfileId = a.BillingProfileId,
                    BillingProfileName = a.BillingProfile != null ? a.BillingProfile.Name : null,
                    PreviousExpireDate = a.PreviousExpireDate,
                    CurrentExpireDate = a.CurrentExpireDate,
                    NextExpireDate = a.NextExpireDate,
                    PreviousBalance = a.PreviousBalance,
                    NewBalance = a.NewBalance,
                    Amount = a.Amount,
                    Type = a.Type,
                    Status = a.Status,
                    ApiStatus = a.ApiStatus,
                    ApiStatusCode = a.ApiStatusCode,
                    ApiStatusMessage = a.ApiStatusMessage,
                    ExternalReferenceId = a.ExternalReferenceId,
                    PaymentMethod = a.PaymentMethod,
                    DurationDays = a.DurationDays,
                    Source = a.Source,
                    Notes = a.Notes,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt,
                    DeletedAt = a.DeletedAt,
                    DeletedBy = a.DeletedBy
                })
                .ToListAsync();

            return Ok(new
            {
                data = activations,
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching deleted activations");
            return StatusCode(500, new { error = "An error occurred while fetching deleted activations" });
        }
    }

    // GET: api/RadiusActivation/types
    [HttpGet("types")]
    public ActionResult<IEnumerable<object>> GetActivationTypes()
    {
        var types = new[]
        {
            new { value = "new_activation", label = "New Activation" },
            new { value = "renew", label = "Renew" },
            new { value = "change_profile", label = "Change Profile" },
            new { value = "upgrade", label = "Upgrade" },
            new { value = "downgrade", label = "Downgrade" },
            new { value = "extension", label = "Extension" },
            new { value = "reactivation", label = "Reactivation" },
            new { value = "suspension", label = "Suspension" },
            new { value = "cancellation", label = "Cancellation" }
        };

        return Ok(types);
    }

    // GET: api/RadiusActivation/statuses
    [HttpGet("statuses")]
    public ActionResult<IEnumerable<object>> GetActivationStatuses()
    {
        var statuses = new[]
        {
            new { value = "pending", label = "Pending" },
            new { value = "processing", label = "Processing" },
            new { value = "completed", label = "Completed" },
            new { value = "failed", label = "Failed" },
            new { value = "cancelled", label = "Cancelled" },
            new { value = "rolled_back", label = "Rolled Back" }
        };

        return Ok(statuses);
    }

    // GET: api/RadiusActivation/api-statuses
    [HttpGet("api-statuses")]
    public ActionResult<IEnumerable<object>> GetApiStatuses()
    {
        var statuses = new[]
        {
            new { value = "success", label = "Success" },
            new { value = "failed", label = "Failed" },
            new { value = "timeout", label = "Timeout" },
            new { value = "not_called", label = "Not Called" }
        };

        return Ok(statuses);
    }

    // GET: api/RadiusActivation/stats
    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetActivationStats(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var query = _context.RadiusActivations.AsQueryable();

            if (startDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(a => a.CreatedAt <= endDate.Value);
            }

            var stats = new
            {
                totalActivations = await query.CountAsync(),
                byStatus = await query
                    .GroupBy(a => a.Status)
                    .Select(g => new { status = g.Key, count = g.Count() })
                    .ToListAsync(),
                byType = await query
                    .GroupBy(a => a.Type)
                    .Select(g => new { type = g.Key, count = g.Count() })
                    .ToListAsync(),
                byApiStatus = await query
                    .GroupBy(a => a.ApiStatus)
                    .Select(g => new { apiStatus = g.Key, count = g.Count() })
                    .ToListAsync(),
                totalAmount = await query.SumAsync(a => a.Amount ?? 0),
                successRate = await query.CountAsync() > 0
                    ? Math.Round((double)await query.CountAsync(a => a.Status == "completed") / await query.CountAsync() * 100, 2)
                    : 0
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching activation stats");
            return StatusCode(500, new { error = "An error occurred while fetching activation stats" });
        }
    }
}

public class UpdateActivationStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ApiStatus { get; set; }
    public int? ApiStatusCode { get; set; }
    public string? ApiStatusMessage { get; set; }
    public string? ApiResponse { get; set; }
    public string? ExternalReferenceId { get; set; }
    public decimal? NewBalance { get; set; }
    public DateTime? CurrentExpireDate { get; set; }
}
