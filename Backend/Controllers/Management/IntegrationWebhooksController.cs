using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Cryptography;

namespace Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/workspaces/{workspaceId}/[controller]")]
public class IntegrationWebhooksController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<IntegrationWebhooksController> _logger;
    private readonly IConfiguration _configuration;

    public IntegrationWebhooksController(
        ApplicationDbContext context,
        ILogger<IntegrationWebhooksController> logger,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<IntegrationWebhook>>> GetWebhooks(int workspaceId)
    {
        var webhooks = await _context.IntegrationWebhooks
            .Where(w => w.WorkspaceId == workspaceId && !w.IsDeleted)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();

        return Ok(webhooks);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<IntegrationWebhook>> GetWebhook(int workspaceId, int id)
    {
        var webhook = await _context.IntegrationWebhooks
            .FirstOrDefaultAsync(w => w.Id == id && w.WorkspaceId == workspaceId && !w.IsDeleted);

        if (webhook == null)
            return NotFound();

        return Ok(webhook);
    }

    [HttpPost]
    public async Task<ActionResult<IntegrationWebhook>> CreateWebhook(
        int workspaceId,
        [FromBody] CreateWebhookRequest request)
    {
        var token = GenerateSecureToken();
        var baseUrl = _configuration["AppSettings:BaseUrl"] ?? "http://localhost:5000";
        var webhookUrl = $"{baseUrl}/api/webhooks/{workspaceId}/{request.IntegrationType}/{token}";

        var webhook = new IntegrationWebhook
        {
            WorkspaceId = workspaceId,
            IntegrationName = request.IntegrationName,
            IntegrationType = request.IntegrationType,
            CallbackEnabled = request.CallbackEnabled,
            WebhookToken = token,
            WebhookUrl = webhookUrl,
            RequireAuthentication = request.RequireAuthentication,
            AllowedIpAddresses = request.AllowedIpAddresses,
            Description = request.Description,
            IsActive = true
        };

        _context.IntegrationWebhooks.Add(webhook);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetWebhook), new { workspaceId, id = webhook.Id }, webhook);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateWebhook(
        int workspaceId,
        int id,
        [FromBody] UpdateWebhookRequest request)
    {
        var webhook = await _context.IntegrationWebhooks
            .FirstOrDefaultAsync(w => w.Id == id && w.WorkspaceId == workspaceId && !w.IsDeleted);

        if (webhook == null)
            return NotFound();

        webhook.IntegrationName = request.IntegrationName;
        webhook.IntegrationType = request.IntegrationType;
        webhook.CallbackEnabled = request.CallbackEnabled;
        webhook.RequireAuthentication = request.RequireAuthentication;
        webhook.AllowedIpAddresses = request.AllowedIpAddresses;
        webhook.Description = request.Description;
        webhook.IsActive = request.IsActive;
        webhook.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(webhook);
    }

    [HttpPost("{id}/regenerate-token")]
    public async Task<ActionResult<IntegrationWebhook>> RegenerateToken(int workspaceId, int id)
    {
        var webhook = await _context.IntegrationWebhooks
            .FirstOrDefaultAsync(w => w.Id == id && w.WorkspaceId == workspaceId && !w.IsDeleted);

        if (webhook == null)
            return NotFound();

        var newToken = GenerateSecureToken();
        var baseUrl = _configuration["AppSettings:BaseUrl"] ?? "http://localhost:5000";
        webhook.WebhookToken = newToken;
        webhook.WebhookUrl = $"{baseUrl}/api/webhooks/{workspaceId}/{webhook.IntegrationType}/{newToken}";
        webhook.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(webhook);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWebhook(int workspaceId, int id)
    {
        var webhook = await _context.IntegrationWebhooks
            .FirstOrDefaultAsync(w => w.Id == id && w.WorkspaceId == workspaceId && !w.IsDeleted);

        if (webhook == null)
            return NotFound();

        webhook.IsDeleted = true;
        webhook.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id}/logs")]
    public async Task<ActionResult<IEnumerable<WebhookLog>>> GetWebhookLogs(
        int workspaceId,
        int id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var logs = await _context.WebhookLogs
            .Where(l => l.WebhookId == id && l.WorkspaceId == workspaceId)
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var totalCount = await _context.WebhookLogs
            .CountAsync(l => l.WebhookId == id && l.WorkspaceId == workspaceId);

        return Ok(new
        {
            logs,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(bytes);
        }
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }
}

public class CreateWebhookRequest
{
    public string IntegrationName { get; set; } = string.Empty;
    public string IntegrationType { get; set; } = "sas-radius";
    public bool CallbackEnabled { get; set; } = true;
    public bool RequireAuthentication { get; set; } = true;
    public string? AllowedIpAddresses { get; set; }
    public string? Description { get; set; }
}

public class UpdateWebhookRequest
{
    public string IntegrationName { get; set; } = string.Empty;
    public string IntegrationType { get; set; } = "sas-radius";
    public bool CallbackEnabled { get; set; }
    public bool RequireAuthentication { get; set; }
    public string? AllowedIpAddresses { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}
