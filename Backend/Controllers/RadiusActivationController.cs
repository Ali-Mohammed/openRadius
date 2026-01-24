using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;
using Backend.Helpers;

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
                    BillingActivationId = a.BillingActivationId,
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
        // Use database transaction to ensure atomicity - all changes succeed or all are rolled back
        using var dbTransaction = await _context.Database.BeginTransactionAsync();
        
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

            // Determine which radius profile to use
            var radiusProfileId = request.RadiusProfileId ?? radiusUser.ProfileId;

            // Fetch radius profile name for transaction records
            string? radiusProfileName = null;
            if (radiusProfileId.HasValue)
            {
                var radiusProfile = await _context.RadiusProfiles.FindAsync(radiusProfileId.Value);
                radiusProfileName = radiusProfile?.Name;
            }

            // Fetch billing profile if specified
            BillingProfile? billingProfile = null;
            if (request.BillingProfileId.HasValue)
            {
                billingProfile = await _context.BillingProfiles.FindAsync(request.BillingProfileId.Value);
            }

            // ========================================
            // STEP 1: Create Master Billing Activation Record FIRST
            // This is the primary financial/billing record that all other records reference
            // ========================================
            var billingActivation = new BillingActivation
            {
                BillingProfileId = request.BillingProfileId,
                BillingProfileName = billingProfile?.Name,
                RadiusUserId = radiusUser.Id,
                RadiusUsername = radiusUser.Username,
                ActionById = User.GetSystemUserId(),
                ActionByUsername = userEmail,
                ActionForId = request.ActionForId ?? User.GetSystemUserId(),
                ActionForUsername = request.ActionForUsername ?? userEmail,
                IsActionBehalf = request.IsActionBehalf,
                Amount = request.Amount ?? 0,
                ActivationType = request.Type,
                ActivationStatus = "processing",
                PaymentMethod = request.PaymentMethod,
                RadiusProfileId = radiusProfileId,
                RadiusProfileName = radiusProfileName,
                Source = request.Source ?? "api",
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow,
                ProcessingStartedAt = DateTime.UtcNow
            };

            _context.BillingActivations.Add(billingActivation);
            await _context.SaveChangesAsync(); // Save to get BillingActivation ID
            _logger.LogInformation($"Created master billing activation record {billingActivation.Id} for user {radiusUser.Username}");

            // Generate a unique transaction group ID for all related transactions in this activation
            var transactionGroupId = Guid.NewGuid();
            _logger.LogInformation($"Generated transaction group ID {transactionGroupId} for activation {billingActivation.Id}");

            // Wallet payment validation
            int? transactionId = null;
            var activationTransactionIds = new List<int>(); // Track all transaction IDs created in this activation
            decimal cashbackAmountForRemaining = 0; // Track cashback to deduct from remaining amount (only instant)
            decimal totalCashbackAmount = 0; // Track total cashback amount for billing record
            if (request.PaymentMethod?.ToLower() == "wallet")
            {
                // Get current user ID from MasterDbContext
                var currentUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
                if (currentUser == null)
                {
                    return BadRequest(new { error = "Current user not found" });
                }

                // Determine which user's wallet to use
                // If PayerUserId is specified (on-behalf activation), use that user's wallet
                // Otherwise use the current user's wallet
                int walletOwnerId = request.PayerUserId ?? currentUser.Id;
                string walletOwnerUsername = request.PayerUsername ?? currentUser.Email ?? "unknown";

                // Check if target user has a wallet
                var userWallet = await _context.UserWallets
                    .Include(uw => uw.CustomWallet)
                    .FirstOrDefaultAsync(uw => uw.UserId == walletOwnerId && !uw.IsDeleted);

                if (userWallet == null)
                {
                    return BadRequest(new { error = request.PayerUserId.HasValue 
                        ? $"Payer user {walletOwnerUsername} does not have a wallet." 
                        : "User does not have a wallet. Please create a wallet first." });
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
                userWallet.UpdatedBy = User.GetSystemUserId();

                var onBehalfText = request.IsActionBehalf && request.PayerUserId.HasValue 
                    ? $" (on behalf of {walletOwnerUsername})" 
                    : "";

                var userWalletTransaction = new Transaction
                {
                    WalletType = "user",
                    UserWalletId = userWallet.Id,
                    UserId = walletOwnerId,
                    TransactionType = TransactionType.Payment,
                    AmountType = "debit",
                    Amount = activationAmount,
                    Status = "completed",
                    BalanceBefore = balanceBefore,
                    BalanceAfter = balanceAfter,
                    Description = $"RADIUS user activation for {radiusUser.Username}{onBehalfText}",
                    Reference = $"ACTIVATION-{radiusUser.Id}",
                    PaymentMethod = "Wallet",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = User.GetSystemUserId(),
                    RadiusUserId = radiusUser.Id,
                    RadiusUsername = radiusUser.Username,
                    RadiusProfileId = radiusProfileId,
                    RadiusProfileName = radiusProfileName,
                    BillingActivationId = billingActivation.Id,  // Link to master billing record
                    TransactionGroupId = transactionGroupId  // Link all related transactions
                };

                _context.Transactions.Add(userWalletTransaction);

                // Also create wallet history record for tracking
                var walletHistory = new WalletHistory
                {
                    WalletType = "user",
                    UserWalletId = userWallet.Id,
                    UserId = walletOwnerId,
                    TransactionType = TransactionType.Payment,
                    AmountType = "debit",
                    Amount = activationAmount,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = balanceAfter,
                    Description = $"RADIUS user activation for {radiusUser.Username}{onBehalfText}",
                    Reference = $"ACTIVATION-{radiusUser.Id}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = User.GetSystemUserId()
                };

                _context.WalletHistories.Add(walletHistory);
                await _context.SaveChangesAsync(); // Save to get transaction ID

                activationTransactionIds.Add(userWalletTransaction.Id); // Track this transaction
                transactionId = userWalletTransaction.Id;

                // Update BillingActivation with the primary payment transaction ID
                billingActivation.TransactionId = transactionId;
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Created wallet transaction {userWalletTransaction.Id} for user {walletOwnerId} and history record for activation. Balance: {balanceBefore:F2} -> {balanceAfter:F2}");

                // Calculate cashback amount FIRST (before processing custom wallet deposits)
                // The cashback will be deducted from the remaining amount that goes to custom wallets
                decimal calculatedCashbackAmount = 0;
                string calculatedCashbackSource = "none";
                decimal subAgentCashbackAmount = 0;
                int? subAgentSupervisorId = null;

                if (request.ApplyCashback && request.BillingProfileId.HasValue)
                {
                    // First check for individual user cashback
                    var userCashback = await _context.UserCashbacks
                        .Where(uc => uc.UserId == walletOwnerId && uc.BillingProfileId == request.BillingProfileId.Value && uc.DeletedAt == null)
                        .FirstOrDefaultAsync();

                    if (userCashback != null && userCashback.Amount > 0)
                    {
                        calculatedCashbackAmount = userCashback.Amount;
                        calculatedCashbackSource = "individual";
                    }
                    else
                    {
                        // Check if user belongs to a cashback group
                        var userGroup = await _context.CashbackGroupUsers
                            .Where(cgu => cgu.UserId == walletOwnerId)
                            .Include(cgu => cgu.CashbackGroup)
                            .Where(cgu => cgu.CashbackGroup != null && cgu.CashbackGroup.DeletedAt == null)
                            .FirstOrDefaultAsync();

                        if (userGroup != null)
                        {
                            // Get the cashback amount for this group and billing profile
                            var groupCashback = await _context.CashbackProfileAmounts
                                .Where(cpa => cpa.CashbackGroupId == userGroup.CashbackGroupId && cpa.BillingProfileId == request.BillingProfileId.Value)
                                .FirstOrDefaultAsync();

                            if (groupCashback != null && groupCashback.Amount > 0)
                            {
                                calculatedCashbackAmount = groupCashback.Amount;
                                calculatedCashbackSource = "group";
                            }
                        }
                    }

                    _logger.LogInformation($"Calculated main cashback amount: {calculatedCashbackAmount:F2} ({calculatedCashbackSource}) for user {walletOwnerId}");

                    // Check for sub-agent cashback (if payer has a supervisor)
                    var payerUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.Id == walletOwnerId);
                    if (payerUser?.SupervisorId != null)
                    {
                        var subAgentCashback = await _context.SubAgentCashbacks
                            .Where(sac => 
                                sac.SupervisorId == payerUser.SupervisorId.Value && 
                                sac.SubAgentId == walletOwnerId && 
                                sac.BillingProfileId == request.BillingProfileId.Value &&
                                sac.DeletedAt == null)
                            .FirstOrDefaultAsync();

                        if (subAgentCashback != null && subAgentCashback.Amount > 0)
                        {
                            subAgentCashbackAmount = subAgentCashback.Amount;
                            subAgentSupervisorId = payerUser.SupervisorId.Value;
                            _logger.LogInformation($"Calculated sub-agent cashback amount: {subAgentCashbackAmount:F2} for supervisor {subAgentSupervisorId}");
                        }
                    }
                }

                // Apply cashback to wallet owner's wallet if amount > 0
                // This is done BEFORE custom wallet processing so we can track it
                if (calculatedCashbackAmount > 0)
                {
                    // Check if wallet has custom cashback settings, otherwise use global settings
                    string transactionType;
                    bool requiresApproval;
                    
                    if (userWallet.UsesCustomCashbackSetting && !string.IsNullOrEmpty(userWallet.CustomCashbackType))
                    {
                        // Use wallet-specific cashback settings
                        transactionType = userWallet.CustomCashbackType;
                        requiresApproval = userWallet.CustomCashbackRequiresApproval ?? false;
                        _logger.LogInformation($"Using custom cashback settings for wallet {userWallet.Id}: Type={transactionType}, RequiresApproval={requiresApproval}");
                    }
                    else
                    {
                        // Get cashback settings from master database
                        var cashbackSettings = await _masterContext.CashbackSettings
                            .OrderByDescending(cs => cs.CreatedAt)
                            .FirstOrDefaultAsync();

                        // Default to Instant if no settings exist
                        transactionType = cashbackSettings?.TransactionType ?? "Instant";
                        requiresApproval = cashbackSettings?.RequiresApprovalToCollect ?? false;
                        _logger.LogInformation($"Using global cashback settings: Type={transactionType}, RequiresApproval={requiresApproval}");
                    }

                    // Determine description based on whether this is on-behalf or normal activation
                    var cashbackDescription = request.IsActionBehalf && request.PayerUserId.HasValue
                        ? $"Cashback for activating {radiusUser.Username} on behalf ({calculatedCashbackSource})"
                        : $"Cashback for activating {radiusUser.Username} ({calculatedCashbackSource})";

                    // Determine cashback status based on settings
                    string cashbackStatus;
                    string transactionStatus;
                    decimal cashbackBalanceBefore = userWallet.CurrentBalance;
                    decimal cashbackBalanceAfter = userWallet.CurrentBalance;

                    if (transactionType == "Instant")
                    {
                        // Instant cashback: Add to wallet immediately
                        cashbackStatus = "Completed";
                        transactionStatus = "completed";
                        cashbackBalanceBefore = userWallet.CurrentBalance;
                        userWallet.CurrentBalance += calculatedCashbackAmount;
                        cashbackBalanceAfter = userWallet.CurrentBalance;
                        userWallet.UpdatedAt = DateTime.UtcNow;
                        userWallet.UpdatedBy = User.GetSystemUserId();
                        
                        _logger.LogInformation($"Instant cashback: Added {calculatedCashbackAmount:F2} to wallet. Balance: {cashbackBalanceBefore:F2} -> {cashbackBalanceAfter:F2}");
                    }
                    else // Collected
                    {
                        // Collected cashback: Don't add to wallet, set status based on approval requirement
                        cashbackStatus = requiresApproval ? "WaitingForApproval" : "Pending";
                        transactionStatus = "pending";
                        // Balance remains unchanged for collected cashback
                        cashbackBalanceBefore = userWallet.CurrentBalance;
                        cashbackBalanceAfter = userWallet.CurrentBalance;
                        
                        _logger.LogInformation($"Collected cashback: {calculatedCashbackAmount:F2} set to {cashbackStatus}. Wallet balance unchanged: {userWallet.CurrentBalance:F2}");
                    }

                    // Create cashback transaction with appropriate status
                    var cashbackTransaction = new Transaction
                    {
                        WalletType = "user",
                        UserWalletId = userWallet.Id,
                        UserId = walletOwnerId,
                        TransactionType = TransactionType.Cashback,
                        AmountType = "credit",
                        Amount = calculatedCashbackAmount,
                        Status = transactionStatus,
                        CashbackStatus = cashbackStatus,  // Track cashback lifecycle
                        BalanceBefore = cashbackBalanceBefore,
                        BalanceAfter = cashbackBalanceAfter,
                        Description = cashbackDescription,
                        Reference = $"CASHBACK-{radiusUser.Id}",
                        PaymentMethod = "Cashback",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId(),
                        RadiusUserId = radiusUser.Id,
                        RadiusUsername = radiusUser.Username,
                        RadiusProfileId = radiusProfileId,
                        RadiusProfileName = radiusProfileName,
                        BillingProfileId = request.BillingProfileId,
                        BillingProfileName = request.BillingProfileId.HasValue ? (await _context.BillingProfiles.FindAsync(request.BillingProfileId.Value))?.Name : null,
                        BillingActivationId = billingActivation.Id,  // Link to master billing record
                        TransactionGroupId = transactionGroupId  // Link all related transactions
                    };
                    _context.Transactions.Add(cashbackTransaction);

                    // Create wallet history only for instant cashback (when balance actually changed)
                    if (transactionType == "Instant")
                    {
                        var cashbackHistory = new WalletHistory
                        {
                            WalletType = "user",
                            UserWalletId = userWallet.Id,
                            UserId = walletOwnerId,
                            TransactionType = TransactionType.Cashback,
                            AmountType = "credit",
                            Amount = calculatedCashbackAmount,
                            BalanceBefore = cashbackBalanceBefore,
                            BalanceAfter = cashbackBalanceAfter,
                            Description = cashbackDescription,
                            Reference = $"CASHBACK-{radiusUser.Id}",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetSystemUserId()
                        };

                        _context.WalletHistories.Add(cashbackHistory);
                    }

                    await _context.SaveChangesAsync();
                    activationTransactionIds.Add(cashbackTransaction.Id); // Track cashback transaction

                    _logger.LogInformation($"Created cashback transaction {cashbackTransaction.Id} with status '{cashbackStatus}' for user {walletOwnerId}. Type: {transactionType}, Amount: {calculatedCashbackAmount:F2}");
                    
                    // Track total cashback amount for billing record
                    totalCashbackAmount = calculatedCashbackAmount;
                    
                    // Store cashback amount to be deducted from remaining amount ONLY if instant
                    // For collected cashback, the money hasn't been paid out yet, so it shouldn't reduce the remaining amount
                    if (transactionType == "Instant")
                    {
                        cashbackAmountForRemaining = calculatedCashbackAmount;
                    }
                }

                // Apply sub-agent cashback to supervisor's wallet if amount > 0
                if (subAgentCashbackAmount > 0 && subAgentSupervisorId.HasValue)
                {
                    // Get supervisor's wallet
                    var supervisorWallet = await _context.UserWallets
                        .FirstOrDefaultAsync(uw => uw.UserId == subAgentSupervisorId.Value && !uw.IsDeleted && uw.Status.ToLower() == "active");

                    if (supervisorWallet != null)
                    {
                        // Get cashback settings to determine transaction type
                        var cashbackSettings = await _masterContext.CashbackSettings
                            .OrderByDescending(cs => cs.CreatedAt)
                            .FirstOrDefaultAsync();

                        var transactionType = cashbackSettings?.TransactionType ?? "Instant";
                        var requiresApproval = cashbackSettings?.RequiresApprovalToCollect ?? false;

                        string subAgentCashbackStatus;
                        string subAgentTransactionStatus;
                        decimal supervisorBalanceBefore = supervisorWallet.CurrentBalance;
                        decimal supervisorBalanceAfter = supervisorWallet.CurrentBalance;

                        if (transactionType == "Instant")
                        {
                            // Instant cashback: Add to supervisor's wallet immediately
                            subAgentCashbackStatus = "Completed";
                            subAgentTransactionStatus = "completed";
                            supervisorWallet.CurrentBalance += subAgentCashbackAmount;
                            supervisorBalanceAfter = supervisorWallet.CurrentBalance;
                            supervisorWallet.UpdatedAt = DateTime.UtcNow;
                            supervisorWallet.UpdatedBy = User.GetSystemUserId();
                            
                            _logger.LogInformation($"Instant sub-agent cashback: Added {subAgentCashbackAmount:F2} to supervisor {subAgentSupervisorId} wallet. Balance: {supervisorBalanceBefore:F2} -> {supervisorBalanceAfter:F2}");
                        }
                        else // Collected
                        {
                            // Collected cashback: Don't add to wallet, set status based on approval requirement
                            subAgentCashbackStatus = requiresApproval ? "WaitingForApproval" : "Pending";
                            subAgentTransactionStatus = "pending";
                            
                            _logger.LogInformation($"Collected sub-agent cashback: {subAgentCashbackAmount:F2} set to {subAgentCashbackStatus} for supervisor {subAgentSupervisorId}. Wallet balance unchanged: {supervisorWallet.CurrentBalance:F2}");
                        }

                        // Create sub-agent cashback transaction
                        var subAgentCashbackTransaction = new Transaction
                        {
                            WalletType = "user",
                            UserWalletId = supervisorWallet.Id,
                            UserId = subAgentSupervisorId.Value,
                            TransactionType = TransactionType.Cashback,
                            AmountType = "credit",
                            Amount = subAgentCashbackAmount,
                            Status = subAgentTransactionStatus,
                            CashbackStatus = subAgentCashbackStatus,
                            BalanceBefore = supervisorBalanceBefore,
                            BalanceAfter = supervisorBalanceAfter,
                            Description = $"Sub-agent cashback for {radiusUser.Username} activation by sub-agent",
                            Reference = $"SUBAGENT-CASHBACK-{radiusUser.Id}",
                            PaymentMethod = "SubAgentCashback",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetSystemUserId(),
                            RadiusUserId = radiusUser.Id,
                            RadiusUsername = radiusUser.Username,
                            RadiusProfileId = radiusProfileId,
                            RadiusProfileName = radiusProfileName,
                            BillingProfileId = request.BillingProfileId,
                            BillingProfileName = request.BillingProfileId.HasValue ? (await _context.BillingProfiles.FindAsync(request.BillingProfileId.Value))?.Name : null,
                            BillingActivationId = billingActivation.Id,
                            TransactionGroupId = transactionGroupId  // Link all related transactions
                        };
                        _context.Transactions.Add(subAgentCashbackTransaction);

                        // Create wallet history only for instant sub-agent cashback
                        if (transactionType == "Instant")
                        {
                            var subAgentCashbackHistory = new WalletHistory
                            {
                                WalletType = "user",
                                UserWalletId = supervisorWallet.Id,
                                UserId = subAgentSupervisorId.Value,
                                TransactionType = TransactionType.Cashback,
                                AmountType = "credit",
                                Amount = subAgentCashbackAmount,
                                BalanceBefore = supervisorBalanceBefore,
                                BalanceAfter = supervisorBalanceAfter,
                                Description = $"Sub-agent cashback for {radiusUser.Username} activation",
                                Reference = $"SUBAGENT-CASHBACK-{radiusUser.Id}",
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = User.GetSystemUserId()
                            };
                            _context.WalletHistories.Add(subAgentCashbackHistory);

                            // Include sub-agent cashback in remaining amount deduction
                            cashbackAmountForRemaining += subAgentCashbackAmount;
                        }

                        await _context.SaveChangesAsync();
                        activationTransactionIds.Add(subAgentCashbackTransaction.Id);

                        _logger.LogInformation($"Created sub-agent cashback transaction {subAgentCashbackTransaction.Id} with status '{subAgentCashbackStatus}' for supervisor {subAgentSupervisorId}. Amount: {subAgentCashbackAmount:F2}");
                        
                        // Add to total cashback amount
                        totalCashbackAmount += subAgentCashbackAmount;
                    }
                    else
                    {
                        _logger.LogWarning($"Supervisor {subAgentSupervisorId} does not have an active wallet. Sub-agent cashback {subAgentCashbackAmount:F2} not applied.");
                    }
                }
            }

            // Process custom wallet deposits from RADIUS profile FIRST (before billing profile)
            var radiusProfileWalletTotal = 0m;
            if (radiusProfileId.HasValue)
            {
                var profileWallets = await _context.RadiusProfileWallets
                    .Include(pw => pw.CustomWallet)
                    .Where(pw => pw.RadiusProfileId == radiusProfileId.Value 
                        && pw.CustomWallet.Status.ToLower() == "active")
                    .ToListAsync();

                foreach (var profileWallet in profileWallets)
                {
                    var customWallet = profileWallet.CustomWallet;
                    var depositAmount = profileWallet.Amount;

                    // Update custom wallet balance
                    var customBalanceBefore = customWallet.CurrentBalance;
                    customWallet.CurrentBalance += depositAmount;
                    customWallet.UpdatedAt = DateTime.UtcNow;
                    radiusProfileWalletTotal += depositAmount;

                    // Create transaction for custom wallet deposit
                    var customTransaction = new Transaction
                    {
                        WalletType = "custom",
                        CustomWalletId = customWallet.Id,
                        UserId = null, // Custom wallets are not user-specific
                        TransactionType = TransactionType.TopUp,
                        AmountType = "credit",
                        Amount = depositAmount,
                        Status = "completed",
                        BalanceBefore = customBalanceBefore,
                        BalanceAfter = customWallet.CurrentBalance,
                        Description = $"RADIUS profile wallet deposit for {radiusUser.Username} activation",
                        Reference = $"ACTIVATION-{radiusUser.Id}",
                        PaymentMethod = "Activation",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId(),
                        RadiusUserId = radiusUser.Id,
                        RadiusUsername = radiusUser.Username,
                        RadiusProfileId = radiusProfileId,
                        RadiusProfileName = radiusProfileName,
                        BillingActivationId = billingActivation.Id,  // Link to master billing record
                        TransactionGroupId = transactionGroupId  // Link all related transactions
                    };

                    _context.Transactions.Add(customTransaction);

                    // Create wallet history for custom wallet
                    var customWalletHistory = new WalletHistory
                    {
                        WalletType = "custom",
                        CustomWalletId = customWallet.Id,
                        UserId = null,
                        TransactionType = TransactionType.TopUp,
                        AmountType = "credit",
                        Amount = depositAmount,
                        BalanceBefore = customBalanceBefore,
                        BalanceAfter = customWallet.CurrentBalance,
                        Description = $"RADIUS profile wallet deposit for {radiusUser.Username} activation",
                        Reference = $"ACTIVATION-{radiusUser.Id}",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetSystemUserId()
                    };

                    _context.WalletHistories.Add(customWalletHistory);

                    _logger.LogInformation($"Added {depositAmount:F2} to custom wallet '{customWallet.Name}' (ID: {customWallet.Id}) from RADIUS profile. Balance: {customBalanceBefore:F2} -> {customWallet.CurrentBalance:F2}");
                }

                // Save changes to get transaction IDs, then track them
                if (profileWallets.Any())
                {
                    await _context.SaveChangesAsync();
                    
                    // Track all custom wallet transaction IDs
                    foreach (var profileWallet in profileWallets)
                    {
                        var lastTransaction = await _context.Transactions
                            .Where(t => t.CustomWalletId == profileWallet.CustomWalletId && 
                                      t.RadiusUserId == radiusUser.Id &&
                                      t.Reference == $"ACTIVATION-{radiusUser.Id}" &&
                                      t.Description.Contains("RADIUS profile wallet deposit"))
                            .OrderByDescending(t => t.Id)
                            .FirstOrDefaultAsync();
                        
                        if (lastTransaction != null)
                        {
                            activationTransactionIds.Add(lastTransaction.Id);
                        }
                    }
                    
                    _logger.LogInformation($"Processed {profileWallets.Count} RADIUS profile wallet deposit(s) for activation. Total: {radiusProfileWalletTotal:F2}");
                }
            }

            // Process billing profile wallets if applicable (AFTER RADIUS profile wallets)
            var billingProfileId = request.BillingProfileId ?? radiusUser.ProfileBillingId;
            
            if (billingProfileId.HasValue && request.PaymentMethod?.ToLower() == "wallet")
            {
                billingProfile = await _context.BillingProfiles
                    .Include(bp => bp.ProfileWallets)
                    .ThenInclude(pw => pw.CustomWallet)
                    .FirstOrDefaultAsync(bp => bp.Id == billingProfileId.Value);

                if (billingProfile?.ProfileWallets != null && billingProfile.ProfileWallets.Any())
                {
                    var activationAmount = request.Amount ?? 0;
                    var totalInAmount = 0m;

                    // Step 1: Process "out" direction wallets first (deductions from custom wallets)
                    var outWallets = billingProfile.ProfileWallets
                        .Where(pw => pw.Direction?.ToLower() == "out" && 
                                   pw.WalletType == "custom" && 
                                   pw.CustomWallet != null && 
                                   pw.CustomWallet.Status?.ToLower() == "active")
                        .OrderBy(pw => pw.DisplayOrder)
                        .ToList();

                    foreach (var profileWallet in outWallets)
                    {
                        if (profileWallet.CustomWallet == null) continue;

                        var customWallet = profileWallet.CustomWallet;
                        var walletAmount = profileWallet.Percentage;
                        var balanceBefore = customWallet.CurrentBalance;
                        customWallet.CurrentBalance -= walletAmount;
                        customWallet.UpdatedAt = DateTime.UtcNow;

                        // Create transaction
                        var outTransaction = new Transaction
                        {
                            WalletType = "custom",
                            CustomWalletId = customWallet.Id,
                            UserId = null,
                            TransactionType = TransactionType.Payment,
                            AmountType = "debit",
                            Amount = walletAmount,
                            Status = "completed",
                            BalanceBefore = balanceBefore,
                            BalanceAfter = customWallet.CurrentBalance,
                            Description = $"Billing profile deduction for {radiusUser.Username} activation",
                            Reference = $"ACTIVATION-{radiusUser.Id}",
                            PaymentMethod = "Activation",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetSystemUserId(),
                            RadiusUserId = radiusUser.Id,
                            RadiusUsername = radiusUser.Username,
                            RadiusProfileId = radiusProfileId,
                            RadiusProfileName = radiusProfileName,
                            BillingProfileId = billingProfileId,
                            BillingProfileName = billingProfile.Name,
                            BillingActivationId = billingActivation.Id,  // Link to master billing record
                            TransactionGroupId = transactionGroupId  // Link all related transactions
                        };
                        _context.Transactions.Add(outTransaction);

                        // Create wallet history
                        var walletHistory = new WalletHistory
                        {
                            WalletType = "custom",
                            CustomWalletId = customWallet.Id,
                            UserId = null,
                            TransactionType = TransactionType.Payment,
                            AmountType = "debit",
                            Amount = walletAmount,
                            BalanceBefore = balanceBefore,
                            BalanceAfter = customWallet.CurrentBalance,
                            Description = $"Billing profile deduction for {radiusUser.Username} activation",
                            Reference = $"ACTIVATION-{radiusUser.Id}",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetSystemUserId()
                        };
                        _context.WalletHistories.Add(walletHistory);

                        _logger.LogInformation($"Deducted {walletAmount:F2} from custom wallet '{customWallet.Name}' (Direction: out). Balance: {balanceBefore:F2} -> {customWallet.CurrentBalance:F2}");
                    }

                    // Step 2: Process "in" direction wallets (fixed amounts to custom wallets)
                    var inWallets = billingProfile.ProfileWallets
                        .Where(pw => pw.Direction?.ToLower() == "in" && 
                                   pw.WalletType == "custom" && 
                                   pw.CustomWallet != null && 
                                   pw.CustomWallet.Status?.ToLower() == "active")
                        .OrderBy(pw => pw.DisplayOrder)
                        .ToList();

                    foreach (var profileWallet in inWallets)
                    {
                        if (profileWallet.CustomWallet == null) continue;

                        var customWallet = profileWallet.CustomWallet;
                        var walletAmount = profileWallet.Percentage;
                        var balanceBefore = customWallet.CurrentBalance;
                        customWallet.CurrentBalance += walletAmount;
                        customWallet.UpdatedAt = DateTime.UtcNow;
                        totalInAmount += walletAmount;

                        // Create transaction
                        var inTransaction = new Transaction
                        {
                            WalletType = "custom",
                            CustomWalletId = customWallet.Id,
                            UserId = null,
                            TransactionType = TransactionType.TopUp,
                            AmountType = "credit",
                            Amount = walletAmount,
                            Status = "completed",
                            BalanceBefore = balanceBefore,
                            BalanceAfter = customWallet.CurrentBalance,
                            Description = $"Billing profile distribution for {radiusUser.Username} activation",
                            Reference = $"ACTIVATION-{radiusUser.Id}",
                            PaymentMethod = "Activation",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetSystemUserId(),
                            RadiusUserId = radiusUser.Id,
                            RadiusUsername = radiusUser.Username,
                            RadiusProfileId = radiusProfileId,
                            RadiusProfileName = radiusProfileName,
                            BillingProfileId = billingProfileId,
                            BillingProfileName = billingProfile.Name,
                            BillingActivationId = billingActivation.Id,  // Link to master billing record
                            TransactionGroupId = transactionGroupId  // Link all related transactions
                        };
                        _context.Transactions.Add(inTransaction);

                        // Create wallet history
                        var walletHistory = new WalletHistory
                        {
                            WalletType = "custom",
                            CustomWalletId = customWallet.Id,
                            UserId = null,
                            TransactionType = TransactionType.TopUp,
                            AmountType = "credit",
                            Amount = walletAmount,
                            BalanceBefore = balanceBefore,
                            BalanceAfter = customWallet.CurrentBalance,
                            Description = $"Billing profile distribution for {radiusUser.Username} activation",
                            Reference = $"ACTIVATION-{radiusUser.Id}",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetSystemUserId()
                        };
                        _context.WalletHistories.Add(walletHistory);

                        _logger.LogInformation($"Added {walletAmount:F2} to custom wallet '{customWallet.Name}' (Direction: in). Balance: {balanceBefore:F2} -> {customWallet.CurrentBalance:F2}");
                    }

                    // Step 3: Calculate remaining amount and process "remaining" wallets
                    // Remaining = activation price - RADIUS profile wallet deposits - billing profile "in" wallet amounts - cashback
                    // The cashback is deducted from the remaining amount that goes to custom wallets
                    var remainingAmount = activationAmount - radiusProfileWalletTotal - totalInAmount - cashbackAmountForRemaining;
                    
                    _logger.LogInformation($"Remaining amount calculation: {activationAmount:F2} - {radiusProfileWalletTotal:F2} (RADIUS) - {totalInAmount:F2} (in) - {cashbackAmountForRemaining:F2} (cashback) = {remainingAmount:F2}");

                    if (remainingAmount > 0)
                    {
                        var remainingWallets = billingProfile.ProfileWallets
                            .Where(pw => pw.Direction?.ToLower() == "remaining" && 
                                       pw.WalletType == "custom" && 
                                       pw.CustomWallet != null && 
                                       pw.CustomWallet.Status?.ToLower() == "active")
                            .OrderBy(pw => pw.DisplayOrder)
                            .ToList();

                        foreach (var profileWallet in remainingWallets)
                        {
                            if (profileWallet.CustomWallet == null) continue;

                            var customWallet = profileWallet.CustomWallet;
                            var balanceBefore = customWallet.CurrentBalance;
                            customWallet.CurrentBalance += remainingAmount;
                            customWallet.UpdatedAt = DateTime.UtcNow;

                            // Create transaction
                            var remainingTransaction = new Transaction
                            {
                                WalletType = "custom",
                                CustomWalletId = customWallet.Id,
                                UserId = null,
                                TransactionType = TransactionType.TopUp,
                                AmountType = "credit",
                                Amount = remainingAmount,
                                Status = "completed",
                                BalanceBefore = balanceBefore,
                                BalanceAfter = customWallet.CurrentBalance,
                                Description = $"Remaining balance from {radiusUser.Username} activation",
                                Reference = $"ACTIVATION-{radiusUser.Id}",
                                PaymentMethod = "Activation",
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = User.GetSystemUserId(),
                                RadiusUserId = radiusUser.Id,
                                RadiusUsername = radiusUser.Username,
                                RadiusProfileId = radiusProfileId,
                                RadiusProfileName = radiusProfileName,
                                BillingProfileId = billingProfileId,
                                BillingProfileName = billingProfile.Name,
                                BillingActivationId = billingActivation.Id,  // Link to master billing record
                                TransactionGroupId = transactionGroupId  // Link all related transactions
                            };
                            _context.Transactions.Add(remainingTransaction);

                            // Create wallet history
                            var walletHistory = new WalletHistory
                            {
                                WalletType = "custom",
                                CustomWalletId = customWallet.Id,
                                UserId = null,
                                TransactionType = TransactionType.TopUp,
                                AmountType = "credit",
                                Amount = remainingAmount,
                                BalanceBefore = balanceBefore,
                                BalanceAfter = customWallet.CurrentBalance,
                                Description = $"Remaining balance from {radiusUser.Username} activation",
                                Reference = $"ACTIVATION-{radiusUser.Id}",
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = User.GetSystemUserId()
                            };
                            _context.WalletHistories.Add(walletHistory);

                            _logger.LogInformation($"Added remaining {remainingAmount:F2} to custom wallet '{customWallet.Name}' (Direction: remaining). Balance: {balanceBefore:F2} -> {customWallet.CurrentBalance:F2}");
                        }
                    }

                    if (billingProfile.ProfileWallets.Any())
                    {
                        await _context.SaveChangesAsync();
                        
                        // Track all billing profile transaction IDs
                        var billingTransactions = await _context.Transactions
                            .Where(t => t.RadiusUserId == radiusUser.Id &&
                                      t.Reference == $"ACTIVATION-{radiusUser.Id}" &&
                                      t.BillingProfileId == billingProfileId &&
                                      (t.Description.Contains("Billing profile deduction") ||
                                       t.Description.Contains("Billing profile distribution") ||
                                       t.Description.Contains("Remaining balance")))
                            .Select(t => t.Id)
                            .ToListAsync();
                        
                        activationTransactionIds.AddRange(billingTransactions);
                        
                        _logger.LogInformation($"Processed billing profile wallet distributions. Activation: {activationAmount:F2}, RADIUS Profile Wallets: {radiusProfileWalletTotal:F2}, Billing 'in': {totalInAmount:F2}, Remaining: {remainingAmount:F2}");
                    }
                }
            }

            var activation = new RadiusActivation
            {
                BillingActivationId = billingActivation.Id,  // Link to master billing record
                ActionById = User.GetSystemUserId(),
                ActionByUsername = userEmail,
                ActionForId = request.ActionForId ?? User.GetSystemUserId(),
                ActionForUsername = request.ActionForUsername ?? userEmail,
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
                var currentExpiration = radiusUser.Expiration ?? now;
                var baseDate = currentExpiration > now ? currentExpiration : now;
                var newExpiration = baseDate.AddDays(request.DurationDays.Value);
                
                radiusUser.Expiration = newExpiration;
                activation.CurrentExpireDate = currentExpiration;
                activation.NextExpireDate = newExpiration;
            }
            
            // Update RADIUS profile if specified
            if (request.RadiusProfileId.HasValue)
            {
                radiusUser.ProfileId = request.RadiusProfileId.Value;
            }
            
            // Update billing profile if specified
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

            // Link all tracked transactions to this activation (legacy ActivationId for compatibility)
            // New transactions should use BillingActivationId instead
            if (activationTransactionIds.Any())
            {
                var transactionsToUpdate = await _context.Transactions
                    .Where(t => activationTransactionIds.Contains(t.Id))
                    .ToListAsync();

                foreach (var txn in transactionsToUpdate)
                {
                    txn.ActivationId = activation.Id;  // Legacy field for backward compatibility
                }
                
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Linked {transactionsToUpdate.Count} transactions to activation {activation.Id}");
            }

            // Update billing activation record status now that RadiusActivation is created
            billingActivation.ActivationStatus = activation.Status;
            billingActivation.CashbackAmount = totalCashbackAmount; // Track total cashback (instant or collected)
            billingActivation.NewExpireDate = activation.NextExpireDate;
            billingActivation.ProcessingCompletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            _logger.LogInformation($"Updated billing activation record {billingActivation.Id} with RadiusActivation {activation.Id}");

            // Commit the database transaction - all changes are now permanent
            await dbTransaction.CommitAsync();
            _logger.LogInformation($"Successfully committed all changes for activation {activation.Id} and billing activation {billingActivation.Id}");

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
            // Rollback transaction on any error - all changes will be reverted
            await dbTransaction.RollbackAsync();
            _logger.LogError(ex, "Error creating activation - transaction rolled back");
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
            activation.DeletedBy = User.GetSystemUserId();
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
