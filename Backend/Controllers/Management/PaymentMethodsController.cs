using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.DTOs;
using Backend.Models.Management;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;

namespace Backend.Controllers.Management
{
    [Authorize]
    [ApiController]
    [Route("api/payment-methods")]
    public class PaymentMethodsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PaymentMethodsController> _logger;

        public PaymentMethodsController(
            ApplicationDbContext context,
            ILogger<PaymentMethodsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/payment-methods
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PaymentMethodDto>>> GetPaymentMethods()
        {
            try
            {
                var paymentMethods = await _context.PaymentMethods
                    .OrderByDescending(pm => pm.CreatedAt)
                    .ToListAsync();

                // Resolve wallet names for linked wallets
                var walletIds = paymentMethods
                    .Where(pm => pm.WalletId.HasValue)
                    .Select(pm => pm.WalletId!.Value)
                    .Distinct()
                    .ToList();

                var walletNames = walletIds.Any()
                    ? await _context.CustomWallets
                        .Where(w => walletIds.Contains(w.Id))
                        .ToDictionaryAsync(w => w.Id, w => w.Name)
                    : new Dictionary<int, string>();

                var dtos = paymentMethods.Select(pm => new PaymentMethodDto
                {
                    Id = pm.Id,
                    Type = pm.Type,
                    Name = pm.Name,
                    IsActive = pm.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(pm.Settings) ?? new { },
                    WalletId = pm.WalletId,
                    WalletName = pm.WalletId.HasValue && walletNames.TryGetValue(pm.WalletId.Value, out var name) ? name : null
                }).ToList();

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment methods");
                return StatusCode(500, new { message = "An error occurred while retrieving payment methods" });
            }
        }

        // GET: api/payment-methods/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<PaymentMethodDto>> GetPaymentMethod(int id)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == id);

                if (paymentMethod == null)
                {
                    return NotFound(new { message = "Payment method not found" });
                }

                string? walletName = null;
                if (paymentMethod.WalletId.HasValue)
                {
                    walletName = await _context.CustomWallets
                        .Where(w => w.Id == paymentMethod.WalletId.Value)
                        .Select(w => w.Name)
                        .FirstOrDefaultAsync();
                }

                var dto = new PaymentMethodDto
                {
                    Id = paymentMethod.Id,
                    Type = paymentMethod.Type,
                    Name = paymentMethod.Name,
                    IsActive = paymentMethod.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(paymentMethod.Settings) ?? new { },
                    WalletId = paymentMethod.WalletId,
                    WalletName = walletName
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment method {Id}", id);
                return StatusCode(500, new { message = "An error occurred while retrieving the payment method" });
            }
        }

        // POST: api/payment-methods
        [HttpPost]
        public async Task<ActionResult<PaymentMethodDto>> CreatePaymentMethod(
            [FromBody] CreatePaymentMethodDto dto)
        {
            try
            {
                // Validate payment type
                var validTypes = new[] { "ZainCash", "ZainCashV2", "QICard", "Switch" };
                if (!validTypes.Contains(dto.Type))
                {
                    return BadRequest(new { message = "Invalid payment method type. Must be ZainCash, ZainCashV2, QICard, or Switch" });
                }

                // Validate WalletId if provided
                string? walletName = null;
                if (dto.WalletId.HasValue)
                {
                    var wallet = await _context.CustomWallets.FirstOrDefaultAsync(w => w.Id == dto.WalletId.Value);
                    if (wallet == null)
                    {
                        return BadRequest(new { message = "The specified custom wallet does not exist" });
                    }
                    walletName = wallet.Name;
                }

                var paymentMethod = new PaymentMethod
                {
                    Type = dto.Type,
                    Name = dto.Name,
                    IsActive = dto.IsActive,
                    Settings = JsonSerializer.Serialize(dto.Settings),
                    WalletId = dto.WalletId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.PaymentMethods.Add(paymentMethod);
                await _context.SaveChangesAsync();

                var responseDto = new PaymentMethodDto
                {
                    Id = paymentMethod.Id,
                    Type = paymentMethod.Type,
                    Name = paymentMethod.Name,
                    IsActive = paymentMethod.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(paymentMethod.Settings) ?? new { },
                    WalletId = paymentMethod.WalletId,
                    WalletName = walletName
                };

                return CreatedAtAction(
                    nameof(GetPaymentMethod),
                    new { id = paymentMethod.Id },
                    responseDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating payment method");
                return StatusCode(500, new { message = "An error occurred while creating the payment method" });
            }
        }

        // PUT: api/payment-methods/{id}
        [HttpPut("{id}")]
        public async Task<ActionResult<PaymentMethodDto>> UpdatePaymentMethod(
            int id,
            [FromBody] UpdatePaymentMethodDto dto)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == id);

                if (paymentMethod == null)
                {
                    return NotFound(new { message = "Payment method not found" });
                }

                if (!string.IsNullOrEmpty(dto.Name))
                {
                    paymentMethod.Name = dto.Name;
                }

                if (dto.IsActive.HasValue)
                {
                    paymentMethod.IsActive = dto.IsActive.Value;
                }

                if (dto.Settings != null)
                {
                    paymentMethod.Settings = JsonSerializer.Serialize(dto.Settings);
                }

                // Handle wallet linking
                if (dto.ClearWalletId)
                {
                    paymentMethod.WalletId = null;
                }
                else if (dto.WalletId.HasValue)
                {
                    var wallet = await _context.CustomWallets.FirstOrDefaultAsync(w => w.Id == dto.WalletId.Value);
                    if (wallet == null)
                    {
                        return BadRequest(new { message = "The specified custom wallet does not exist" });
                    }
                    paymentMethod.WalletId = dto.WalletId.Value;
                }

                paymentMethod.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // Resolve wallet name for response
                string? walletName = null;
                if (paymentMethod.WalletId.HasValue)
                {
                    walletName = await _context.CustomWallets
                        .Where(w => w.Id == paymentMethod.WalletId.Value)
                        .Select(w => w.Name)
                        .FirstOrDefaultAsync();
                }

                var responseDto = new PaymentMethodDto
                {
                    Id = paymentMethod.Id,
                    Type = paymentMethod.Type,
                    Name = paymentMethod.Name,
                    IsActive = paymentMethod.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(paymentMethod.Settings) ?? new { },
                    WalletId = paymentMethod.WalletId,
                    WalletName = walletName
                };

                return Ok(responseDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payment method {Id}", id);
                return StatusCode(500, new { message = "An error occurred while updating the payment method" });
            }
        }

        // DELETE: api/payment-methods/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePaymentMethod(int id)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == id);

                if (paymentMethod == null)
                {
                    return NotFound(new { message = "Payment method not found" });
                }

                _context.PaymentMethods.Remove(paymentMethod);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting payment method {Id}", id);
                return StatusCode(500, new { message = "An error occurred while deleting the payment method" });
            }
        }
    }
}
