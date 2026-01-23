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
public class ActivationHistoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ActivationHistoryController> _logger;

    public ActivationHistoryController(
        ApplicationDbContext context,
        ILogger<ActivationHistoryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/ActivationHistory
    [HttpGet]
    public async Task<ActionResult<object>> GetActivationHistories(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] int? billingProfileId = null,
        [FromQuery] int? radiusUserId = null,
        [FromQuery] string? activationType = null,
        [FromQuery] string? activationStatus = null,
        [FromQuery] string? paymentMethod = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            var query = _context.ActivationHistories
                .Where(h => !h.IsDeleted)
                .AsQueryable();

            // Apply filters
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(h => 
                    (h.RadiusUsername != null && h.RadiusUsername.Contains(search)) ||
                    (h.ActionByUsername != null && h.ActionByUsername.Contains(search)) ||
                    (h.ActionForUsername != null && h.ActionForUsername.Contains(search)) ||
                    (h.BillingProfileName != null && h.BillingProfileName.Contains(search)) ||
                    (h.RadiusProfileName != null && h.RadiusProfileName.Contains(search)) ||
                    (h.Notes != null && h.Notes.Contains(search)));
            }

            if (billingProfileId.HasValue)
            {
                query = query.Where(h => h.BillingProfileId == billingProfileId.Value);
            }

            if (radiusUserId.HasValue)
            {
                query = query.Where(h => h.RadiusUserId == radiusUserId.Value);
            }

            if (!string.IsNullOrEmpty(activationType))
            {
                query = query.Where(h => h.ActivationType == activationType);
            }

            if (!string.IsNullOrEmpty(activationStatus))
            {
                query = query.Where(h => h.ActivationStatus == activationStatus);
            }

            if (!string.IsNullOrEmpty(paymentMethod))
            {
                query = query.Where(h => h.PaymentMethod == paymentMethod);
            }

            if (startDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt <= endDate.Value);
            }

            // Apply sorting
            query = sortField?.ToLower() switch
            {
                "radiususername" => sortDirection == "asc" 
                    ? query.OrderBy(h => h.RadiusUsername) 
                    : query.OrderByDescending(h => h.RadiusUsername),
                "billingprofilename" => sortDirection == "asc" 
                    ? query.OrderBy(h => h.BillingProfileName) 
                    : query.OrderByDescending(h => h.BillingProfileName),
                "activationtype" => sortDirection == "asc" 
                    ? query.OrderBy(h => h.ActivationType) 
                    : query.OrderByDescending(h => h.ActivationType),
                "activationstatus" => sortDirection == "asc" 
                    ? query.OrderBy(h => h.ActivationStatus) 
                    : query.OrderByDescending(h => h.ActivationStatus),
                "amount" => sortDirection == "asc" 
                    ? query.OrderBy(h => h.Amount) 
                    : query.OrderByDescending(h => h.Amount),
                "createdat" => sortDirection == "asc" 
                    ? query.OrderBy(h => h.CreatedAt) 
                    : query.OrderByDescending(h => h.CreatedAt),
                _ => query.OrderByDescending(h => h.CreatedAt)
            };

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var histories = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(h => new
                {
                    h.Id,
                    h.RadiusActivationId,
                    h.BillingProfileId,
                    h.BillingProfileName,
                    h.RadiusUserId,
                    h.RadiusUsername,
                    h.ActionById,
                    h.ActionByUsername,
                    h.ActionForId,
                    h.ActionForUsername,
                    h.IsActionBehalf,
                    h.Amount,
                    h.CashbackAmount,
                    h.ActivationType,
                    h.ActivationStatus,
                    h.PaymentMethod,
                    h.PreviousExpireDate,
                    h.NewExpireDate,
                    h.DurationDays,
                    h.RadiusProfileId,
                    h.RadiusProfileName,
                    h.TransactionId,
                    h.Source,
                    h.IpAddress,
                    h.Notes,
                    h.CreatedAt,
                    h.ProcessingStartedAt,
                    h.ProcessingCompletedAt
                })
                .ToListAsync();

            return Ok(new
            {
                data = histories,
                page,
                pageSize,
                totalCount,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching activation histories");
            return StatusCode(500, new { error = "An error occurred while fetching activation histories" });
        }
    }

    // GET: api/ActivationHistory/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult> GetActivationHistory(int id)
    {
        try
        {
            var history = await _context.ActivationHistories
                .Where(h => h.Id == id && !h.IsDeleted)
                .Select(h => new
                {
                    h.Id,
                    h.RadiusActivationId,
                    h.BillingProfileId,
                    h.BillingProfileName,
                    h.RadiusUserId,
                    h.RadiusUsername,
                    h.ActionById,
                    h.ActionByUsername,
                    h.ActionForId,
                    h.ActionForUsername,
                    h.IsActionBehalf,
                    h.Amount,
                    h.CashbackAmount,
                    h.ActivationType,
                    h.ActivationStatus,
                    h.PaymentMethod,
                    h.PreviousExpireDate,
                    h.NewExpireDate,
                    h.DurationDays,
                    h.RadiusProfileId,
                    h.RadiusProfileName,
                    h.TransactionId,
                    h.Source,
                    h.IpAddress,
                    h.UserAgent,
                    h.Notes,
                    h.WalletDistribution,
                    h.CreatedAt,
                    h.ProcessingStartedAt,
                    h.ProcessingCompletedAt
                })
                .FirstOrDefaultAsync();

            if (history == null)
            {
                return NotFound(new { error = "Activation history not found" });
            }

            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching activation history {id}");
            return StatusCode(500, new { error = "An error occurred while fetching the activation history" });
        }
    }

    // GET: api/ActivationHistory/billing-profile/{billingProfileId}
    [HttpGet("billing-profile/{billingProfileId}")]
    public async Task<ActionResult> GetBillingProfileActivationHistories(
        int billingProfileId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var query = _context.ActivationHistories
                .Where(h => h.BillingProfileId == billingProfileId && !h.IsDeleted);

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
                .OrderByDescending(h => h.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(h => new
                {
                    h.Id,
                    h.RadiusActivationId,
                    h.RadiusUserId,
                    h.RadiusUsername,
                    h.ActionByUsername,
                    h.Amount,
                    h.CashbackAmount,
                    h.ActivationType,
                    h.ActivationStatus,
                    h.PaymentMethod,
                    h.NewExpireDate,
                    h.DurationDays,
                    h.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                data = histories,
                page,
                pageSize,
                totalCount,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching activation histories for billing profile {billingProfileId}");
            return StatusCode(500, new { error = "An error occurred while fetching activation histories" });
        }
    }

    // GET: api/ActivationHistory/stats
    [HttpGet("stats")]
    public async Task<ActionResult> GetActivationHistoryStats(
        [FromQuery] int? billingProfileId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var query = _context.ActivationHistories
                .Where(h => !h.IsDeleted);

            if (billingProfileId.HasValue)
            {
                query = query.Where(h => h.BillingProfileId == billingProfileId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(h => h.CreatedAt <= endDate.Value);
            }

            var totalActivations = await query.CountAsync();
            var totalRevenue = await query.SumAsync(h => h.Amount ?? 0);
            var totalCashback = await query.SumAsync(h => h.CashbackAmount ?? 0);
            var netRevenue = totalRevenue - totalCashback;

            var byType = await query
                .GroupBy(h => h.ActivationType)
                .Select(g => new
                {
                    Type = g.Key,
                    Count = g.Count(),
                    TotalAmount = g.Sum(h => h.Amount ?? 0)
                })
                .ToListAsync();

            var byStatus = await query
                .GroupBy(h => h.ActivationStatus)
                .Select(g => new
                {
                    Status = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            var byPaymentMethod = await query
                .GroupBy(h => h.PaymentMethod)
                .Select(g => new
                {
                    PaymentMethod = g.Key,
                    Count = g.Count(),
                    TotalAmount = g.Sum(h => h.Amount ?? 0)
                })
                .ToListAsync();

            return Ok(new
            {
                totalActivations,
                totalRevenue,
                totalCashback,
                netRevenue,
                byType,
                byStatus,
                byPaymentMethod
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching activation history stats");
            return StatusCode(500, new { error = "An error occurred while fetching activation history stats" });
        }
    }
}
