using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId}/settings")]
[Authorize]
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
            churnDays = workspace.ChurnDays,
            dateFormat = workspace.DateFormat ?? "MM/DD/YYYY"
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
        workspace.DateFormat = request.DateFormat;
        workspace.UpdatedAt = DateTime.UtcNow;
        
        await _masterContext.SaveChangesAsync();
        
        _logger.LogInformation("Updated general settings for workspace {WorkspaceId}", workspaceId);

        return Ok(new { message = "Settings updated successfully" });
    }

    [HttpGet("tag-sync-rules")]
    public async Task<ActionResult<object>> GetTagSyncRules(int workspaceId)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(workspaceId);
        
        if (workspace == null)
        {
            return NotFound(new { error = "Workspace not found" });
        }

        var rules = string.IsNullOrEmpty(workspace.TagSyncRules) 
            ? new List<object>() 
            : JsonSerializer.Deserialize<List<object>>(workspace.TagSyncRules);

        return Ok(new { rules });
    }

    [HttpPost("tag-sync-rules")]
    public async Task<ActionResult> SaveTagSyncRules(int workspaceId, [FromBody] TagSyncRulesRequest request)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(workspaceId);
        
        if (workspace == null)
        {
            return NotFound(new { error = "Workspace not found" });
        }

        workspace.TagSyncRules = JsonSerializer.Serialize(request.Rules);
        workspace.UpdatedAt = DateTime.UtcNow;
        
        await _masterContext.SaveChangesAsync();
        
        _logger.LogInformation("Updated tag sync rules for workspace {WorkspaceId}", workspaceId);

        return Ok(new { message = "Tag sync rules saved successfully" });
    }
}

public class GeneralSettingsRequest
{
    public required string Currency { get; set; }
    public int ChurnDays { get; set; } = 20;
    public string DateFormat { get; set; } = "MM/DD/YYYY";
}

public class TagSyncRulesRequest
{
    public required List<TagSyncRule> Rules { get; set; }
}

public class TagSyncRule
{
    public required string Id { get; set; }
    public int TagId { get; set; }
    public required string TagName { get; set; }
    public object? FilterGroup { get; set; }
}
