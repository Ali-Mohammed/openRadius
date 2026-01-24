using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CashbackSettingsController : ControllerBase
{
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<CashbackSettingsController> _logger;

    public CashbackSettingsController(
        MasterDbContext masterContext,
        ILogger<CashbackSettingsController> logger)
    {
        _masterContext = masterContext;
        _logger = logger;
    }

    /// <summary>
    /// Get current cashback settings
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<CashbackSettings>> GetSettings()
    {
        try
        {
            var settings = await _masterContext.CashbackSettings
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (settings == null)
            {
                // Return default settings if none exist
                return Ok(new CashbackSettings
                {
                    TransactionType = "Instant",
                    MinimumCollectionAmount = 0,
                    RequiresApprovalToCollect = false
                });
            }

            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cashback settings");
            return StatusCode(500, new { error = "Failed to retrieve cashback settings" });
        }
    }

    /// <summary>
    /// Update cashback settings
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CashbackSettings>> UpdateSettings([FromBody] CashbackSettingsDto dto)
    {
        try
        {
            var currentUserId = User.GetSystemUserId();

            var existingSettings = await _masterContext.CashbackSettings
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (existingSettings != null)
            {
                // Update existing settings
                existingSettings.TransactionType = dto.TransactionType;
                existingSettings.CollectionSchedule = dto.CollectionSchedule;
                existingSettings.MinimumCollectionAmount = dto.MinimumCollectionAmount;
                existingSettings.RequiresApprovalToCollect = dto.RequiresApprovalToCollect;
                existingSettings.UpdatedAt = DateTime.UtcNow;
                existingSettings.UpdatedBy = currentUserId;

                await _masterContext.SaveChangesAsync();
                return Ok(existingSettings);
            }
            else
            {
                // Create new settings
                var newSettings = new CashbackSettings
                {
                    TransactionType = dto.TransactionType,
                    CollectionSchedule = dto.CollectionSchedule,
                    MinimumCollectionAmount = dto.MinimumCollectionAmount,
                    RequiresApprovalToCollect = dto.RequiresApprovalToCollect,
                    CreatedBy = currentUserId,
                    CreatedAt = DateTime.UtcNow
                };

                _masterContext.CashbackSettings.Add(newSettings);
                await _masterContext.SaveChangesAsync();
                return Ok(newSettings);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cashback settings");
            return StatusCode(500, new { error = "Failed to update cashback settings" });
        }
    }
}

/// <summary>
/// DTO for updating cashback settings
/// </summary>
public class CashbackSettingsDto
{
    public string TransactionType { get; set; } = "Instant";
    public string? CollectionSchedule { get; set; }
    public decimal MinimumCollectionAmount { get; set; } = 0;
    public bool RequiresApprovalToCollect { get; set; } = false;
}
