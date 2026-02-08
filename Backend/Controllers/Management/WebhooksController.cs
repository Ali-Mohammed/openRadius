using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Diagnostics;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WebhooksController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        ApplicationDbContext context,
        ILogger<WebhooksController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost("{workspaceId}/{integrationType}/{token}")]
    public async Task<IActionResult> ProcessWebhook(int workspaceId, string integrationType, string token)
    {
        var stopwatch = Stopwatch.StartNew();
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        
        try
        {
            // Find webhook by token, workspace, and integration type
            var webhook = await _context.IntegrationWebhooks
                .FirstOrDefaultAsync(w => 
                    w.WorkspaceId == workspaceId && 
                    w.IntegrationType.ToLower() == integrationType.ToLower() &&
                    w.WebhookToken == token && 
                    !w.IsDeleted &&
                    w.IsActive);

            if (webhook == null)
            {
                await LogWebhookRequest(0, workspaceId, 404, null, "Webhook not found", false, stopwatch.ElapsedMilliseconds);
                return NotFound(new { error = "Webhook not found" });
            }

            if (!webhook.CallbackEnabled)
            {
                await LogWebhookRequest(webhook.Id, workspaceId, 403, null, "Webhook callback disabled", false, stopwatch.ElapsedMilliseconds);
                return StatusCode(403, new { error = "Webhook callback is disabled" });
            }

            // Check IP whitelist if configured
            if (!string.IsNullOrEmpty(webhook.AllowedIpAddresses))
            {
                var allowedIps = JsonSerializer.Deserialize<string[]>(webhook.AllowedIpAddresses);
                if (allowedIps != null && !allowedIps.Contains(clientIp))
                {
                    await LogWebhookRequest(webhook.Id, workspaceId, 403, null, $"IP {clientIp} not allowed", false, stopwatch.ElapsedMilliseconds);
                    return StatusCode(403, new { error = "IP address not allowed" });
                }
            }

            // Read request body
            string requestBody;
            using (var reader = new StreamReader(Request.Body))
            {
                requestBody = await reader.ReadToEndAsync();
            }

            if (string.IsNullOrWhiteSpace(requestBody))
            {
                await LogWebhookRequest(webhook.Id, workspaceId, 400, null, "Empty request body", false, stopwatch.ElapsedMilliseconds);
                return BadRequest(new { error = "Request body is empty" });
            }

            // Parse the incoming data
            RadiusUserUpdateRequest? updateRequest;
            try
            {
                updateRequest = JsonSerializer.Deserialize<RadiusUserUpdateRequest>(requestBody, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (JsonException ex)
            {
                await LogWebhookRequest(webhook.Id, workspaceId, 400, requestBody, $"Invalid JSON: {ex.Message}", false, stopwatch.ElapsedMilliseconds);
                return BadRequest(new { error = "Invalid JSON format", details = ex.Message });
            }

            if (updateRequest == null)
            {
                await LogWebhookRequest(webhook.Id, workspaceId, 400, requestBody, "Failed to parse request", false, stopwatch.ElapsedMilliseconds);
                return BadRequest(new { error = "Failed to parse request" });
            }

            // Process the update
            var result = await ProcessRadiusUserUpdate(workspaceId, updateRequest);

            stopwatch.Stop();
            await LogWebhookRequest(
                webhook.Id, 
                workspaceId, 
                result.Success ? 200 : 400, 
                requestBody, 
                result.Message, 
                result.Success, 
                stopwatch.ElapsedMilliseconds);

            // Update webhook stats
            webhook.LastUsedAt = DateTime.UtcNow;
            webhook.RequestCount++;
            await _context.SaveChangesAsync();

            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    data = result.Data
                });
            }
            else
            {
                return BadRequest(new
                {
                    success = false,
                    error = result.Message
                });
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error processing webhook for workspace {WorkspaceId}", workspaceId);
            await LogWebhookRequest(0, workspaceId, 500, null, ex.Message, false, stopwatch.ElapsedMilliseconds);
            return StatusCode(500, new { error = "Internal server error", details = ex.Message });
        }
    }

    private async Task<ProcessingResult> ProcessRadiusUserUpdate(int workspaceId, RadiusUserUpdateRequest request)
    {
        try
        {
            // Find the RADIUS user by username or external ID
            var radiusUser = await _context.RadiusUsers
                .FirstOrDefaultAsync(u => 
                    !u.IsDeleted &&
                    (u.Username == request.Username || u.ExternalId.ToString() == request.ExternalId));

            if (radiusUser == null)
            {
                // Optionally create a new user if not found
                if (request.CreateIfNotExists)
                {
                    radiusUser = new RadiusUser
                    {
                        Username = request.Username,
                        CreatedAt = DateTime.UtcNow
                    };
                    
                    if (!string.IsNullOrEmpty(request.ExternalId) && int.TryParse(request.ExternalId, out int externalId))
                    {
                        radiusUser.ExternalId = externalId;
                    }
                    
                    _context.RadiusUsers.Add(radiusUser);
                }
                else
                {
                    return new ProcessingResult
                    {
                        Success = false,
                        Message = $"RADIUS user '{request.Username}' not found"
                    };
                }
            }

            // Update user fields
            if (!string.IsNullOrEmpty(request.Password))
                radiusUser.Password = request.Password;

            if (!string.IsNullOrEmpty(request.FirstName))
                radiusUser.Firstname = request.FirstName;

            if (!string.IsNullOrEmpty(request.LastName))
                radiusUser.Lastname = request.LastName;

            if (!string.IsNullOrEmpty(request.Email))
                radiusUser.Email = request.Email;

            if (!string.IsNullOrEmpty(request.PhoneNumber))
                radiusUser.Phone = request.PhoneNumber;

            if (!string.IsNullOrEmpty(request.Address))
                radiusUser.Address = request.Address;

            if (request.ProfileId.HasValue)
                radiusUser.ProfileId = request.ProfileId.Value;

            if (request.GroupId.HasValue)
                radiusUser.GroupId = request.GroupId.Value;

            if (request.IsEnabled.HasValue)
                radiusUser.Enabled = request.IsEnabled.Value;

            if (!string.IsNullOrEmpty(request.ExternalId) && int.TryParse(request.ExternalId, out int extId))
                radiusUser.ExternalId = extId;

            radiusUser.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new ProcessingResult
            {
                Success = true,
                Message = $"RADIUS user '{request.Username}' updated successfully",
                Data = new { radiusUserId = radiusUser.Id, username = radiusUser.Username }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating RADIUS user {Username}", request.Username);
            return new ProcessingResult
            {
                Success = false,
                Message = $"Error updating user: {ex.Message}"
            };
        }
    }

    private async Task LogWebhookRequest(
        int webhookId,
        int workspaceId,
        int statusCode,
        string? requestBody,
        string? message,
        bool success,
        long processingTimeMs)
    {
        try
        {
            var log = new WebhookLog
            {
                WebhookId = webhookId,
                WorkspaceId = workspaceId,
                Method = Request.Method,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Headers = JsonSerializer.Serialize(Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString())),
                RequestBody = requestBody,
                StatusCode = statusCode,
                ResponseBody = message,
                ErrorMessage = success ? null : message,
                Success = success,
                ProcessingTimeMs = (int)processingTimeMs,
                CreatedAt = DateTime.UtcNow
            };

            _context.WebhookLogs.Add(log);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to log webhook request");
        }
    }
}

public class RadiusUserUpdateRequest
{
    public string Username { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string? Password { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public int? ProfileId { get; set; }
    public int? GroupId { get; set; }
    public bool? IsEnabled { get; set; }
    public bool CreateIfNotExists { get; set; } = false;
}

public class ProcessingResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? Data { get; set; }
}
