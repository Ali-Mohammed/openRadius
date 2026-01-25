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
    [Route("api/workspaces/{workspaceId}/payment-methods")]
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

        // GET: api/workspaces/{workspaceId}/payment-methods
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PaymentMethodDto>>> GetPaymentMethods(int workspaceId)
        {
            try
            {
                var paymentMethods = await _context.PaymentMethods
                    .Where(pm => pm.WorkspaceId == workspaceId)
                    .OrderByDescending(pm => pm.CreatedAt)
                    .ToListAsync();

                var dtos = paymentMethods.Select(pm => new PaymentMethodDto
                {
                    Id = pm.Id,
                    Type = pm.Type,
                    Name = pm.Name,
                    IsActive = pm.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(pm.Settings) ?? new { }
                }).ToList();

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment methods for workspace {WorkspaceId}", workspaceId);
                return StatusCode(500, new { message = "An error occurred while retrieving payment methods" });
            }
        }

        // GET: api/workspaces/{workspaceId}/payment-methods/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<PaymentMethodDto>> GetPaymentMethod(int workspaceId, int id)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == id && pm.WorkspaceId == workspaceId);

                if (paymentMethod == null)
                {
                    return NotFound(new { message = "Payment method not found" });
                }

                var dto = new PaymentMethodDto
                {
                    Id = paymentMethod.Id,
                    Type = paymentMethod.Type,
                    Name = paymentMethod.Name,
                    IsActive = paymentMethod.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(paymentMethod.Settings) ?? new { }
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment method {Id} for workspace {WorkspaceId}", id, workspaceId);
                return StatusCode(500, new { message = "An error occurred while retrieving the payment method" });
            }
        }

        // POST: api/workspaces/{workspaceId}/payment-methods
        [HttpPost]
        public async Task<ActionResult<PaymentMethodDto>> CreatePaymentMethod(
            int workspaceId,
            [FromBody] CreatePaymentMethodDto dto)
        {
            try
            {
                // Validate payment type
                var validTypes = new[] { "ZainCash", "QICard", "Switch" };
                if (!validTypes.Contains(dto.Type))
                {
                    return BadRequest(new { message = "Invalid payment method type. Must be ZainCash, QICard, or Switch" });
                }

                var paymentMethod = new PaymentMethod
                {
                    Type = dto.Type,
                    Name = dto.Name,
                    IsActive = dto.IsActive,
                    Settings = JsonSerializer.Serialize(dto.Settings),
                    WorkspaceId = workspaceId,
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
                    Settings = JsonSerializer.Deserialize<object>(paymentMethod.Settings) ?? new { }
                };

                return CreatedAtAction(
                    nameof(GetPaymentMethod),
                    new { workspaceId, id = paymentMethod.Id },
                    responseDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating payment method for workspace {WorkspaceId}", workspaceId);
                return StatusCode(500, new { message = "An error occurred while creating the payment method" });
            }
        }

        // PUT: api/workspaces/{workspaceId}/payment-methods/{id}
        [HttpPut("{id}")]
        public async Task<ActionResult<PaymentMethodDto>> UpdatePaymentMethod(
            int workspaceId,
            int id,
            [FromBody] UpdatePaymentMethodDto dto)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == id && pm.WorkspaceId == workspaceId);

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

                paymentMethod.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                var responseDto = new PaymentMethodDto
                {
                    Id = paymentMethod.Id,
                    Type = paymentMethod.Type,
                    Name = paymentMethod.Name,
                    IsActive = paymentMethod.IsActive,
                    Settings = JsonSerializer.Deserialize<object>(paymentMethod.Settings) ?? new { }
                };

                return Ok(responseDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payment method {Id} for workspace {WorkspaceId}", id, workspaceId);
                return StatusCode(500, new { message = "An error occurred while updating the payment method" });
            }
        }

        // DELETE: api/workspaces/{workspaceId}/payment-methods/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePaymentMethod(int workspaceId, int id)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == id && pm.WorkspaceId == workspaceId);

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
                _logger.LogError(ex, "Error deleting payment method {Id} for workspace {WorkspaceId}", id, workspaceId);
                return StatusCode(500, new { message = "An error occurred while deleting the payment method" });
            }
        }
    }
}
