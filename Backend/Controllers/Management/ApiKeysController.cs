using Backend.DTOs;
using Backend.Helpers;
using Backend.Models;
using Backend.Services;
using Finbuckle.MultiTenant.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers.Management;

/// <summary>
/// Management endpoints for API keys. Requires Keycloak authentication + settings.api-keys.* permissions.
/// API keys are workspace-scoped — they belong to the current user's active workspace.
/// </summary>
[ApiController]
[Route("api/api-keys")]
[Authorize]
public class ApiKeysController : ControllerBase
{
    private readonly IApiKeyService _apiKeyService;
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;
    private readonly ILogger<ApiKeysController> _logger;

    public ApiKeysController(
        IApiKeyService apiKeyService,
        IMultiTenantContextAccessor<WorkspaceTenantInfo> tenantAccessor,
        ILogger<ApiKeysController> logger)
    {
        _apiKeyService = apiKeyService;
        _tenantAccessor = tenantAccessor;
        _logger = logger;
    }

    private int GetWorkspaceId() =>
        _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? 0;

    /// <summary>List all API keys for the current workspace.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? search = null)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "No workspace context." });

        var result = await _apiKeyService.ListAsync(workspaceId, page, pageSize, search);
        return Ok(result);
    }

    /// <summary>Get a single API key by UUID.</summary>
    [HttpGet("{uuid:guid}")]
    public async Task<IActionResult> GetByUuid(Guid uuid)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "No workspace context." });

        var dto = await _apiKeyService.GetByUuidAsync(uuid, workspaceId);
        if (dto == null)
            return NotFound(new { message = "API key not found." });

        return Ok(dto);
    }

    /// <summary>Create a new API key. The raw key is returned only in this response.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateApiKeyRequest request)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "No workspace context." });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });

        var userId = User.GetSystemUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "User identity could not be resolved." });

        var result = await _apiKeyService.CreateAsync(request, workspaceId, userId.Value);
        return Created($"api/api-keys/{result.Uuid}", result);
    }

    /// <summary>Update an existing API key (name, scopes, expiration, active status).</summary>
    [HttpPut("{uuid:guid}")]
    public async Task<IActionResult> Update(Guid uuid, [FromBody] UpdateApiKeyRequest request)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "No workspace context." });

        var userId = User.GetSystemUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "User identity could not be resolved." });

        var result = await _apiKeyService.UpdateAsync(uuid, request, workspaceId, userId.Value);
        if (result == null)
            return NotFound(new { message = "API key not found." });

        return Ok(result);
    }

    /// <summary>Delete (soft) an API key.</summary>
    [HttpDelete("{uuid:guid}")]
    public async Task<IActionResult> Delete(Guid uuid)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "No workspace context." });

        var userId = User.GetSystemUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "User identity could not be resolved." });

        var deleted = await _apiKeyService.DeleteAsync(uuid, workspaceId, userId.Value);
        if (!deleted)
            return NotFound(new { message = "API key not found." });

        return Ok(new { message = "API key deleted." });
    }

    /// <summary>Get available scopes that can be assigned to API keys.</summary>
    [HttpGet("scopes")]
    public IActionResult GetScopes()
    {
        return Ok(_apiKeyService.GetAvailableScopes());
    }
}
