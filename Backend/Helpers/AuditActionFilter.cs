using System.Text.Json;
using Backend.DTOs;
using Backend.Helpers;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Backend.Helpers;

/// <summary>
/// Global async action filter that automatically records audit log entries
/// for all mutating HTTP operations (POST, PUT, PATCH, DELETE).
/// 
/// Behavior:
///   • GET / HEAD / OPTIONS → skipped (read-only).
///   • [NoAudit] on controller or action → skipped.
///   • [Audit(...)] overrides inferred action / entity / category / description.
///   • Runs AFTER the action executes so the response can be inspected for
///     the entity UUID and to determine success vs. failure.
/// </summary>
public class AuditActionFilter : IAsyncActionFilter
{
    private readonly IAuditService _auditService;
    private readonly ILogger<AuditActionFilter> _logger;

    // Serialiser options shared across calls
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        // Avoid issues with cycles or EF navigation properties
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        MaxDepth = 8,
    };

    public AuditActionFilter(IAuditService auditService, ILogger<AuditActionFilter> logger)
    {
        _auditService = auditService;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var httpMethod = context.HttpContext.Request.Method;

        // ── Skip read-only verbs ─────────────────────────────────────────
        if (httpMethod is "GET" or "HEAD" or "OPTIONS")
        {
            await next();
            return;
        }

        // ── Skip if [NoAudit] is present ─────────────────────────────────
        var controllerDescriptor = context.ActionDescriptor;
        var actionAttrs = controllerDescriptor.EndpointMetadata;

        if (actionAttrs.OfType<NoAuditAttribute>().Any())
        {
            await next();
            return;
        }

        // ── Gather pre-action context ────────────────────────────────────
        var auditMeta = actionAttrs.OfType<AuditAttribute>().FirstOrDefault();
        var controllerName = (context.Controller.GetType().Name)
            .Replace("Controller", "", StringComparison.OrdinalIgnoreCase);

        var action = auditMeta?.Action ?? MapHttpMethodToAction(httpMethod);
        var entityType = auditMeta?.EntityType ?? InferEntityType(controllerName);
        var category = auditMeta?.Category ?? InferCategory(controllerName, entityType);

        // Serialise the incoming request body (action arguments)
        string? requestBody = null;
        try
        {
            // Filter out things that can't/shouldn't be serialised
            var serialisableArgs = context.ActionArguments
                .Where(kv => kv.Value is not null
                    && kv.Value is not CancellationToken
                    && kv.Value is not IFormFile
                    && kv.Value is not IFormFileCollection)
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            if (serialisableArgs.Count > 0)
                requestBody = SafeSerialize(serialisableArgs);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Audit: Could not serialise request body for {Entity}.{Action}", entityType, action);
        }

        // ── Execute the action ───────────────────────────────────────────
        var executedContext = await next();

        // ── Post-action: build & record audit entry ──────────────────────
        try
        {
            var status = "Success";
            string? errorMessage = null;
            string? responseBody = null;
            Guid? entityUuid = null;

            if (executedContext.Exception != null && !executedContext.ExceptionHandled)
            {
                status = "Failure";
                errorMessage = executedContext.Exception.Message;
            }
            else if (executedContext.Result is ObjectResult objResult)
            {
                var statusCode = objResult.StatusCode ?? 200;
                if (statusCode >= 400)
                {
                    status = "Failure";
                    errorMessage = TryExtractErrorMessage(objResult.Value);
                }

                // Try to extract entity UUID from the response
                entityUuid = TryExtractUuid(objResult.Value);

                // Capture the response body for create/update
                if (action is "Create" or "Update" or "Activate" or "Deactivate"
                    or "TopUp" or "Deduct" or "Assign" or "Unassign"
                    or "StatusChange" or "Restore")
                {
                    responseBody = SafeSerialize(objResult.Value);
                }
            }
            else if (executedContext.Result is StatusCodeResult statusResult && statusResult.StatusCode >= 400)
            {
                status = "Failure";
            }

            var description = auditMeta?.Description
                ?? BuildDescription(action, entityType, entityUuid, status);

            var dto = new CreateAuditLogDto
            {
                Action = action,
                EntityType = entityType,
                EntityUuid = entityUuid,
                Category = category,
                NewData = action == "Create" ? responseBody : (action == "Delete" ? null : responseBody),
                PreviousData = null, // We can't easily get the "before" snapshot in a filter
                Description = description,
                Status = status,
                ErrorMessage = errorMessage,
            };

            // Record the audit entry — the service captures RequestPath from HttpContext
            await _auditService.LogAsync(dto, context.HttpContext.User, context.HttpContext);
        }
        catch (Exception ex)
        {
            // Audit logging should NEVER break the actual operation
            _logger.LogWarning(ex, "Audit: Failed to record audit entry for {Entity}.{Action}", entityType, action);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string MapHttpMethodToAction(string method) => method switch
    {
        "POST" => "Create",
        "PUT" => "Update",
        "PATCH" => "Update",
        "DELETE" => "Delete",
        _ => method,
    };

    /// <summary>
    /// Infers a clean entity type name from the controller class name.
    /// e.g. "RadiusUser" from "RadiusUserController", "CustomWallet" from "CustomWalletController"
    /// </summary>
    private static string InferEntityType(string controllerName)
    {
        // Some controllers have compound names — keep them as-is
        // "BillingActivations" → "BillingActivation" (singularise)
        var name = controllerName;

        // Remove trailing 's' for simple plurals (not if ends in "ss")
        if (name.EndsWith("s", StringComparison.Ordinal) && !name.EndsWith("ss", StringComparison.Ordinal))
            name = name[..^1];

        return name;
    }

    /// <summary>
    /// Maps entity types / controller names to audit categories.
    /// </summary>
    private static string InferCategory(string controllerName, string entityType)
    {
        var lower = controllerName.ToLowerInvariant();

        if (lower.StartsWith("radius") || lower.Contains("zone") || lower.Contains("freeradius"))
            return "RADIUS";
        if (lower.StartsWith("billing") || lower.Contains("wallet") || lower.Contains("topup")
            || lower.Contains("cashback") || lower.Contains("addon") || lower.Contains("transaction")
            || lower.Contains("balance") || lower.Contains("automation"))
            return "Billing";
        if (lower.StartsWith("payment"))
            return "Payment";
        if (lower.Contains("user") || lower.Contains("role") || lower.Contains("permission")
            || lower.Contains("group"))
            return "UserManagement";
        if (lower.StartsWith("olt") || lower.StartsWith("fdt") || lower.StartsWith("fat")
            || lower.Contains("network") || lower.Contains("sas"))
            return "Network";
        if (lower.Contains("connector") || lower.Contains("debezium") || lower.Contains("cdc")
            || lower.Contains("integration") || lower.Contains("webhook"))
            return "Integration";
        if (lower.Contains("setting") || lower.Contains("oidc") || lower.Contains("workspace")
            || lower.Contains("tenant") || lower.Contains("backup") || lower.Contains("update")
            || lower.Contains("navigation") || lower.Contains("dashboard") || lower.Contains("tablepreference"))
            return "Settings";
        if (lower.Contains("audit"))
            return "System";

        return "System";
    }

    /// <summary>
    /// Tries to extract a Guid "uuid" / "Uuid" property from the response object.
    /// Handles anonymous types, DTOs, and dictionaries.
    /// </summary>
    private static Guid? TryExtractUuid(object? value)
    {
        if (value is null) return null;

        try
        {
            // Check common property names
            var type = value.GetType();
            var prop = type.GetProperty("Uuid") ?? type.GetProperty("uuid")
                       ?? type.GetProperty("UUID");
            if (prop != null)
            {
                var val = prop.GetValue(value);
                if (val is Guid g && g != Guid.Empty) return g;
            }

            // Also try nested — e.g. Ok(new { data = entity })
            var dataProp = type.GetProperty("data") ?? type.GetProperty("Data");
            if (dataProp != null)
            {
                var inner = dataProp.GetValue(value);
                if (inner != null)
                {
                    var innerUuid = inner.GetType().GetProperty("Uuid") ?? inner.GetType().GetProperty("uuid");
                    if (innerUuid != null)
                    {
                        var val = innerUuid.GetValue(inner);
                        if (val is Guid g && g != Guid.Empty) return g;
                    }
                }
            }
        }
        catch { /* reflection failures are non-critical */ }

        return null;
    }

    private static string? TryExtractErrorMessage(object? value)
    {
        if (value is null) return null;
        try
        {
            var type = value.GetType();
            var prop = type.GetProperty("error") ?? type.GetProperty("Error")
                       ?? type.GetProperty("message") ?? type.GetProperty("Message");
            return prop?.GetValue(value)?.ToString();
        }
        catch { return null; }
    }

    private static string BuildDescription(string action, string entityType, Guid? entityUuid, string status)
    {
        var uuidPart = entityUuid.HasValue ? $" ({entityUuid.Value.ToString()[..8]}…)" : "";
        return $"{action} {entityType}{uuidPart} — {status}";
    }

    private static string? SafeSerialize(object? value)
    {
        if (value is null) return null;
        try
        {
            var json = JsonSerializer.Serialize(value, _jsonOptions);
            // Cap at 50 KB to avoid bloating the audit table
            return json.Length > 50_000 ? json[..50_000] + "…(truncated)" : json;
        }
        catch
        {
            return null;
        }
    }
}
