using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/instants/{instantId}/sas-radius")]
public class SasRadiusIntegrationController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ILogger<SasRadiusIntegrationController> _logger;

    public SasRadiusIntegrationController(MasterDbContext context, ILogger<SasRadiusIntegrationController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SasRadiusIntegration>>> GetIntegrations(int instantId)
    {
        var integrations = await _context.SasRadiusIntegrations
            .Where(i => i.InstantId == instantId)
            .OrderByDescending(i => i.IsActive)
            .ThenBy(i => i.Name)
            .ToListAsync();

        return Ok(integrations);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SasRadiusIntegration>> GetIntegration(int instantId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (integration == null)
        {
            return NotFound();
        }

        return Ok(integration);
    }

    [HttpPost]
    public async Task<ActionResult<SasRadiusIntegration>> CreateIntegration(int instantId, [FromBody] SasRadiusIntegration integration)
    {
        // Verify instant exists
        var instant = await _context.Instants.FindAsync(instantId);
        if (instant == null)
        {
            return NotFound($"Instant with ID {instantId} not found");
        }

        // If this integration is marked as active, deactivate all others for this instant
        if (integration.IsActive)
        {
            var activeIntegrations = await _context.SasRadiusIntegrations
                .Where(i => i.InstantId == instantId && i.IsActive)
                .ToListAsync();

            foreach (var activeIntegration in activeIntegrations)
            {
                activeIntegration.IsActive = false;
                activeIntegration.UpdatedAt = DateTime.UtcNow;
            }
        }

        integration.InstantId = instantId;
        integration.CreatedAt = DateTime.UtcNow;
        integration.UpdatedAt = DateTime.UtcNow;

        _context.SasRadiusIntegrations.Add(integration);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created SAS Radius integration {Name} for instant {InstantId}", integration.Name, instantId);

        return CreatedAtAction(nameof(GetIntegration), new { instantId, id = integration.Id }, integration);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIntegration(int instantId, int id, [FromBody] SasRadiusIntegration integration)
    {
        if (id != integration.Id)
        {
            return BadRequest("ID mismatch");
        }

        var existingIntegration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (existingIntegration == null)
        {
            return NotFound();
        }

        // If this integration is being marked as active, deactivate all others for this instant
        if (integration.IsActive && !existingIntegration.IsActive)
        {
            var activeIntegrations = await _context.SasRadiusIntegrations
                .Where(i => i.InstantId == instantId && i.IsActive && i.Id != id)
                .ToListAsync();

            foreach (var activeIntegration in activeIntegrations)
            {
                activeIntegration.IsActive = false;
                activeIntegration.UpdatedAt = DateTime.UtcNow;
            }
        }

        existingIntegration.Name = integration.Name;
        existingIntegration.Url = integration.Url;
        existingIntegration.Username = integration.Username;
        existingIntegration.Password = integration.Password;
        existingIntegration.UseHttps = integration.UseHttps;
        existingIntegration.IsActive = integration.IsActive;
        existingIntegration.Action = integration.Action;
        existingIntegration.Description = integration.Description;
        existingIntegration.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated SAS Radius integration {Name} for instant {InstantId}", integration.Name, instantId);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIntegration(int instantId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (integration == null)
        {
            return NotFound();
        }

        _context.SasRadiusIntegrations.Remove(integration);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted SAS Radius integration {Name} for instant {InstantId}", integration.Name, instantId);

        return NoContent();
    }
}
