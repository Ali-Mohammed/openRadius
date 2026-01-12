using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId}/settings")]
public class WorkspaceSettingsController : ControllerBase
{
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<WorkspaceSettingsController> _logger;

    public WorkspaceSettingsController(MasterDbContext masterContext, ILogger<WorkspaceSettingsController> logger)
    {
        _masterContext = masterContext;
        _logger = logger;
    }

    [HttpGet("general")]
    public async Task<ActionResult<object>> GetGeneralSettings(int workspaceId)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(workspaceId);
        
        if (workspace == null)
        {
            return NotFound(new { error = "Workspace not found" });
        }

        return Ok(new
        {
            currency = workspace.Currency ?? "USD",
            churnDays = workspace.ChurnDays
        });
    }

    [HttpPut("general")]
    public async Task<ActionResult> UpdateGeneralSettings(int workspaceId, [FromBody] GeneralSettingsRequest request)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(workspaceId);
        
        if (workspace == null)
        {
            return NotFound(new { error = "Workspace not found" });
        }

        workspace.Currency = request.Currency;
        workspace.ChurnDays = request.ChurnDays;
        workspace.UpdatedAt = DateTime.UtcNow;
        
        await _masterContext.SaveChangesAsync();
        
        _logger.LogInformation("Updated general settings for workspace {WorkspaceId}", workspaceId);

        return Ok(new { message = "Settings updated successfully" });
    }
}

public class GeneralSettingsRequest
{
    public required string Currency { get; set; }
    public int ChurnDays { get; set; } = 20;
}
