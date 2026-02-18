using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Backend.Services;

/// <summary>
/// Interface for the automation engine that evaluates and executes workflow automations
/// when domain events occur (user created, updated, activated, etc.)
/// </summary>
public interface IAutomationEngineService
{
    /// <summary>
    /// Fires a domain event and evaluates all active automations that have a matching trigger.
    /// Executes matched workflows asynchronously (fire-and-forget from the caller's perspective).
    /// </summary>
    Task FireEventAsync(AutomationEvent automationEvent);

    /// <summary>
    /// Hangfire-compatible entry point for processing automation events.
    /// Creates its own DbContext from the connection string since Hangfire jobs
    /// run outside the HTTP request scope (no tenant context available).
    /// </summary>
    Task ProcessAutomationEventAsync(string serializedEvent, int workspaceId, string connectionString);
}

/// <summary>
/// Enterprise automation engine that processes workflow automations when domain events fire.
/// 
/// Workflow evaluation:
/// 1. Find all active automations (status = "active", isActive = true)
/// 2. Parse each automation's WorkflowJson to find trigger nodes
/// 3. Match trigger nodes against the fired event type
/// 4. For matched automations, traverse the workflow graph (trigger → actions/conditions)
/// 5. Execute action nodes (including HTTP requests) and evaluate condition nodes
/// 6. Log execution results with per-node step tracking in AutomationExecutionLogs/Steps
/// </summary>
public class AutomationEngineService : IAutomationEngineService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AutomationEngineService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    private const int MaxHttpResponseBodyLength = 65536; // 64KB max stored response body
    private const int HttpTimeoutSeconds = 30;

    public AutomationEngineService(
        ApplicationDbContext context,
        ILogger<AutomationEngineService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    /// <summary>
    /// Hangfire-compatible entry point. Deserializes the event and creates a workspace-scoped
    /// DbContext since Hangfire jobs don't have HTTP context or tenant info.
    /// </summary>
    public async Task ProcessAutomationEventAsync(string serializedEvent, int workspaceId, string connectionString)
    {
        _logger.LogInformation(
            "[Hangfire] Processing automation event for workspace {WorkspaceId}",
            workspaceId);

        var automationEvent = JsonSerializer.Deserialize<AutomationEvent>(serializedEvent, JsonOptions);
        if (automationEvent == null)
        {
            _logger.LogError("[Hangfire] Failed to deserialize automation event");
            return;
        }

        // Create workspace-specific context (Hangfire jobs don't have HTTP context/tenant info)
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        using var workspaceContext = new ApplicationDbContext(optionsBuilder.Options);

        await FireEventInternalAsync(automationEvent, workspaceContext);
    }

    /// <inheritdoc />
    public async Task FireEventAsync(AutomationEvent automationEvent)
    {
        await FireEventInternalAsync(automationEvent, _context);
    }

    /// <summary>
    /// Core event processing logic shared by both the scoped (HTTP) and Hangfire paths.
    /// </summary>
    private async Task FireEventInternalAsync(AutomationEvent automationEvent, ApplicationDbContext context)
    {
        try
        {
            _logger.LogInformation(
                "Automation event fired: {EventType} for user {Username} (ID: {UserId})",
                automationEvent.TriggerType,
                automationEvent.RadiusUsername,
                automationEvent.RadiusUserId);

            var activeAutomations = await context.Automations
                .Where(a => a.Status == "active" && a.IsActive && !a.IsDeleted && a.WorkflowJson != null)
                .ToListAsync();

            if (!activeAutomations.Any())
            {
                _logger.LogDebug("No active automations found to evaluate");
                return;
            }

            _logger.LogInformation("Evaluating {Count} active automations for event {EventType}",
                activeAutomations.Count, automationEvent.TriggerType);

            foreach (var automation in activeAutomations)
            {
                await EvaluateAutomationAsync(automation, automationEvent, context);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Critical error processing automation event {EventType}", automationEvent.TriggerType);
        }
    }

    /// <summary>
    /// Evaluates a single automation's workflow against the fired event.
    /// Creates a full execution log with per-node step tracking.
    /// </summary>
    private async Task EvaluateAutomationAsync(Automation automation, AutomationEvent automationEvent, ApplicationDbContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        AutomationExecutionLog? executionLog = null;

        try
        {
            if (string.IsNullOrEmpty(automation.WorkflowJson))
                return;

            var workflow = JsonSerializer.Deserialize<WorkflowDefinition>(automation.WorkflowJson, JsonOptions);
            if (workflow?.Nodes == null || !workflow.Nodes.Any())
                return;

            // Find trigger nodes that match the event type
            var matchingTriggers = workflow.Nodes
                .Where(n => n.Type == "trigger" && n.Data?.TriggerType == automationEvent.TriggerType)
                .ToList();

            if (!matchingTriggers.Any())
                return;

            _logger.LogInformation(
                "Automation '{Title}' (ID:{Id}) matched event {TriggerType} with {Count} trigger(s)",
                automation.Title, automation.Id, automationEvent.TriggerType, matchingTriggers.Count);

            // Create execution log with full enterprise context
            executionLog = new AutomationExecutionLog
            {
                AutomationId = automation.Id,
                AutomationTitle = automation.Title,
                TriggerType = automationEvent.TriggerType,
                TriggerNodeId = matchingTriggers.First().Id,
                RadiusUserId = automationEvent.RadiusUserId,
                RadiusUserUuid = automationEvent.RadiusUserUuid,
                RadiusUsername = automationEvent.RadiusUsername,
                Status = "running",
                EventData = JsonSerializer.Serialize(automationEvent.Context, JsonOptions),
                WorkflowSnapshot = automation.WorkflowJson,
                TotalNodes = workflow.Nodes?.Count ?? 0,
                TotalEdges = workflow.Edges?.Count ?? 0,
                TriggeredBy = automationEvent.PerformedBy,
                SourceIpAddress = automationEvent.IpAddress,
                Environment = _configuration["ASPNETCORE_ENVIRONMENT"] ?? "Production",
                StartedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            context.AutomationExecutionLogs.Add(executionLog);
            await context.SaveChangesAsync();

            // Execution context to track state across traversal
            var execContext = new ExecutionContext
            {
                ExecutionLog = executionLog,
                StepOrder = 0,
                AutomationEvent = automationEvent,
                DbContext = context
            };

            // Record trigger step
            foreach (var trigger in matchingTriggers)
            {
                execContext.StepOrder++;
                var triggerStep = CreateStep(execContext, trigger, "trigger", trigger.Data?.TriggerType);
                triggerStep.Status = "completed";
                triggerStep.Result = $"Trigger matched: {automationEvent.TriggerType}";
                triggerStep.InputData = JsonSerializer.Serialize(automationEvent.Context, JsonOptions);
                triggerStep.CompletedAt = DateTime.UtcNow;
                context.AutomationExecutionSteps.Add(triggerStep);
                executionLog.NodesVisited++;

                // Traverse from this trigger
                await TraverseFromNodeAsync(trigger, workflow, execContext);
            }

            // Finalize execution log
            stopwatch.Stop();
            executionLog.ExecutionTimeMs = stopwatch.ElapsedMilliseconds;
            executionLog.CompletedAt = DateTime.UtcNow;

            if (executionLog.ActionsFailed > 0 && executionLog.ActionsSucceeded > 0)
                executionLog.Status = "completed_with_errors";
            else if (executionLog.ActionsFailed > 0)
                executionLog.Status = "failed";
            else
                executionLog.Status = "completed";

            executionLog.ResultSummary = BuildResultSummary(executionLog);
            await context.SaveChangesAsync();

            _logger.LogInformation(
                "Automation '{Title}' completed: {Succeeded}/{Total} actions succeeded in {Ms}ms [CorrelationId: {CorrelationId}]",
                automation.Title, executionLog.ActionsSucceeded, executionLog.ActionsExecuted,
                stopwatch.ElapsedMilliseconds, executionLog.CorrelationId);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error evaluating automation {Id} '{Title}'", automation.Id, automation.Title);

            if (executionLog != null)
            {
                executionLog.Status = "failed";
                executionLog.ErrorMessage = ex.Message;
                executionLog.ErrorStackTrace = ex.StackTrace;
                executionLog.ExecutionTimeMs = stopwatch.ElapsedMilliseconds;
                executionLog.CompletedAt = DateTime.UtcNow;
                executionLog.ResultSummary = $"Execution failed: {ex.Message}";
                await context.SaveChangesAsync();
            }
            else
            {
                // If we couldn't even create the execution log, create a failure record
                try
                {
                    var failLog = new AutomationExecutionLog
                    {
                        AutomationId = automation.Id,
                        AutomationTitle = automation.Title,
                        TriggerType = automationEvent.TriggerType,
                        RadiusUserId = automationEvent.RadiusUserId,
                        RadiusUserUuid = automationEvent.RadiusUserUuid,
                        RadiusUsername = automationEvent.RadiusUsername,
                        Status = "failed",
                        ErrorMessage = ex.Message,
                        ErrorStackTrace = ex.StackTrace,
                        EventData = JsonSerializer.Serialize(automationEvent.Context, JsonOptions),
                        TriggeredBy = automationEvent.PerformedBy,
                        SourceIpAddress = automationEvent.IpAddress,
                        ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                        ResultSummary = $"Execution failed: {ex.Message}",
                        StartedAt = DateTime.UtcNow,
                        CompletedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow
                    };
                    context.AutomationExecutionLogs.Add(failLog);
                    await context.SaveChangesAsync();
                }
                catch (Exception logEx)
                {
                    _logger.LogError(logEx, "Failed to log execution failure for automation {Id}", automation.Id);
                }
            }
        }
    }

    /// <summary>
    /// Traverses the workflow graph from a node, following edges to execute connected nodes.
    /// Each node visited creates an AutomationExecutionStep record.
    /// </summary>
    private async Task TraverseFromNodeAsync(
        WorkflowNode currentNode,
        WorkflowDefinition workflow,
        ExecutionContext execContext)
    {
        var outgoingEdges = workflow.Edges?
            .Where(e => e.Source == currentNode.Id)
            .ToList() ?? new List<WorkflowEdge>();

        if (!outgoingEdges.Any())
            return;

        foreach (var edge in outgoingEdges)
        {
            var targetNode = workflow.Nodes?.FirstOrDefault(n => n.Id == edge.Target);
            if (targetNode == null) continue;

            switch (targetNode.Type)
            {
                case "action":
                    await ExecuteActionWithStepAsync(targetNode, execContext);
                    await TraverseFromNodeAsync(targetNode, workflow, execContext);
                    break;

                case "condition":
                    var conditionResult = await EvaluateConditionWithStepAsync(targetNode, execContext);
                    
                    var conditionEdges = workflow.Edges?
                        .Where(e => e.Source == targetNode.Id)
                        .ToList() ?? new List<WorkflowEdge>();

                    foreach (var condEdge in conditionEdges)
                    {
                        var isTrue = condEdge.SourceHandle == "true" || condEdge.SourceHandle == null;
                        var isFalse = condEdge.SourceHandle == "false";

                        if ((conditionResult && isTrue) || (!conditionResult && isFalse))
                        {
                            var condTarget = workflow.Nodes?.FirstOrDefault(n => n.Id == condEdge.Target);
                            if (condTarget != null)
                            {
                                if (condTarget.Type == "action")
                                {
                                    await ExecuteActionWithStepAsync(condTarget, execContext);
                                    await TraverseFromNodeAsync(condTarget, workflow, execContext);
                                }
                                else
                                {
                                    await TraverseFromNodeAsync(condTarget, workflow, execContext);
                                }
                            }
                        }
                    }
                    break;

                case "comment":
                    await TraverseFromNodeAsync(targetNode, workflow, execContext);
                    break;
            }
        }
    }

    /// <summary>
    /// Executes an action node and records a detailed step.
    /// </summary>
    private async Task ExecuteActionWithStepAsync(WorkflowNode actionNode, ExecutionContext execContext)
    {
        var stepStopwatch = Stopwatch.StartNew();
        execContext.StepOrder++;
        var step = CreateStep(execContext, actionNode, "action", actionNode.Data?.ActionType);
        step.InputData = JsonSerializer.Serialize(execContext.AutomationEvent.Context, JsonOptions);

        execContext.ExecutionLog.NodesVisited++;
        execContext.ExecutionLog.ActionsExecuted++;

        try
        {
            var result = await ExecuteActionAsync(actionNode, execContext.AutomationEvent, step, execContext.DbContext);
            
            stepStopwatch.Stop();
            step.Status = "completed";
            step.Result = result;
            step.ExecutionTimeMs = stepStopwatch.ElapsedMilliseconds;
            step.CompletedAt = DateTime.UtcNow;
            execContext.ExecutionLog.ActionsSucceeded++;
        }
        catch (Exception ex)
        {
            stepStopwatch.Stop();
            step.Status = "failed";
            step.ErrorMessage = ex.Message;
            step.ExecutionTimeMs = stepStopwatch.ElapsedMilliseconds;
            step.CompletedAt = DateTime.UtcNow;
            execContext.ExecutionLog.ActionsFailed++;
            
            _logger.LogError(ex, "Action step failed: {ActionType} for node {NodeId}",
                actionNode.Data?.ActionType, actionNode.Id);
        }

        execContext.DbContext.AutomationExecutionSteps.Add(step);
        await execContext.DbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Evaluates a condition node and records a step with the result.
    /// </summary>
    private async Task<bool> EvaluateConditionWithStepAsync(WorkflowNode conditionNode, ExecutionContext execContext)
    {
        var stepStopwatch = Stopwatch.StartNew();
        execContext.StepOrder++;
        var step = CreateStep(execContext, conditionNode, "condition", conditionNode.Data?.ConditionType);
        step.InputData = JsonSerializer.Serialize(execContext.AutomationEvent.Context, JsonOptions);

        execContext.ExecutionLog.NodesVisited++;
        execContext.ExecutionLog.ConditionsEvaluated++;

        try
        {
            var result = EvaluateCondition(conditionNode, execContext.AutomationEvent);

            stepStopwatch.Stop();
            step.Status = result ? "condition_true" : "condition_false";
            step.Result = $"Condition '{conditionNode.Data?.Label ?? conditionNode.Data?.ConditionType}' evaluated to {result}";
            step.OutputData = JsonSerializer.Serialize(new { conditionResult = result }, JsonOptions);
            step.ExecutionTimeMs = stepStopwatch.ElapsedMilliseconds;
            step.CompletedAt = DateTime.UtcNow;

            execContext.DbContext.AutomationExecutionSteps.Add(step);
            await execContext.DbContext.SaveChangesAsync();
            return result;
        }
        catch (Exception ex)
        {
            stepStopwatch.Stop();
            step.Status = "failed";
            step.ErrorMessage = ex.Message;
            step.ExecutionTimeMs = stepStopwatch.ElapsedMilliseconds;
            step.CompletedAt = DateTime.UtcNow;

            execContext.DbContext.AutomationExecutionSteps.Add(step);
            await execContext.DbContext.SaveChangesAsync();

            _logger.LogError(ex, "Condition evaluation failed: {ConditionType}", conditionNode.Data?.ConditionType);
            return false;
        }
    }

    /// <summary>
    /// Executes an action node. Returns a description of the action taken.
    /// Supports HTTP requests with full request/response logging.
    /// </summary>
    private async Task<string> ExecuteActionAsync(
        WorkflowNode actionNode,
        AutomationEvent automationEvent,
        AutomationExecutionStep step,
        ApplicationDbContext dbContext)
    {
        var actionType = actionNode.Data?.ActionType;

        switch (actionType)
        {
            case "http-request":
                return await ExecuteHttpRequestAsync(actionNode, automationEvent, step);

            case "send-email":
                _logger.LogInformation("Action: Send email to {Username}", automationEvent.RadiusUsername);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "send-email",
                    recipient = automationEvent.RadiusUsername,
                    email = automationEvent.Context.GetValueOrDefault("email")
                }, JsonOptions);
                return $"Send email to {automationEvent.RadiusUsername}";

            case "send-notification":
                _logger.LogInformation("Action: Send notification for {Username}", automationEvent.RadiusUsername);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "send-notification",
                    user = automationEvent.RadiusUsername
                }, JsonOptions);
                return $"Send notification for {automationEvent.RadiusUsername}";

            case "credit-wallet":
                _logger.LogInformation("Action: Credit wallet for {Username}", automationEvent.RadiusUsername);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "credit-wallet",
                    user = automationEvent.RadiusUsername
                }, JsonOptions);
                return $"Credit wallet for {automationEvent.RadiusUsername}";

            case "debit-wallet":
                _logger.LogInformation("Action: Debit wallet for {Username}", automationEvent.RadiusUsername);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "debit-wallet",
                    user = automationEvent.RadiusUsername
                }, JsonOptions);
                return $"Debit wallet for {automationEvent.RadiusUsername}";

            case "suspend-user":
                await SuspendUserAsync(automationEvent.RadiusUserId, dbContext);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "suspend-user",
                    user = automationEvent.RadiusUsername,
                    enabled = false
                }, JsonOptions);
                return $"Suspended user {automationEvent.RadiusUsername}";

            case "apply-discount":
                _logger.LogInformation("Action: Apply discount for {Username}", automationEvent.RadiusUsername);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "apply-discount",
                    user = automationEvent.RadiusUsername
                }, JsonOptions);
                return $"Apply discount for {automationEvent.RadiusUsername}";

            case "update-profile":
                _logger.LogInformation("Action: Update profile for {Username}", automationEvent.RadiusUsername);
                step.OutputData = JsonSerializer.Serialize(new
                {
                    action = "update-profile",
                    user = automationEvent.RadiusUsername
                }, JsonOptions);
                return $"Update profile for {automationEvent.RadiusUsername}";

            default:
                _logger.LogWarning("Unknown action type: {ActionType}", actionType);
                return $"Unknown action: {actionType}";
        }
    }

    /// <summary>
    /// Executes an HTTP request action with full request/response tracking.
    /// Supports template variables like {{username}}, {{email}}, {{balance}} from event context.
    /// </summary>
    private async Task<string> ExecuteHttpRequestAsync(
        WorkflowNode actionNode,
        AutomationEvent automationEvent,
        AutomationExecutionStep step)
    {
        var data = actionNode.Data;
        var method = data?.HttpMethod?.ToUpperInvariant() ?? "GET";
        var url = ResolveTemplateVariables(data?.HttpUrl ?? "", automationEvent);
        var body = ResolveTemplateVariables(data?.HttpBody ?? "", automationEvent);
        var headersJson = data?.HttpHeaders;
        var contentType = data?.HttpContentType ?? "application/json";
        var expectedStatusCodes = data?.HttpExpectedStatusCodes ?? "200-299";
        var timeoutSeconds = data?.HttpTimeoutSeconds ?? HttpTimeoutSeconds;

        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("HTTP Request URL is required");

        _logger.LogInformation("HTTP Request: {Method} {Url}", method, url);

        // Record request details in step
        step.HttpMethod = method;
        step.HttpUrl = url;
        step.HttpRequestBody = body;

        // Parse custom headers
        var headers = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(headersJson))
        {
            try
            {
                headers = JsonSerializer.Deserialize<Dictionary<string, string>>(headersJson, JsonOptions)
                          ?? new Dictionary<string, string>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse HTTP headers JSON, using empty headers");
            }
        }
        step.HttpRequestHeaders = JsonSerializer.Serialize(headers, JsonOptions);

        // Execute the HTTP request
        var httpStopwatch = Stopwatch.StartNew();
        using var client = _httpClientFactory.CreateClient("AutomationEngine");
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);

        var request = new HttpRequestMessage(new HttpMethod(method), url);

        // Add custom headers
        foreach (var header in headers)
        {
            if (header.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
                continue; // Content-Type is set on content
            
            if (header.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase))
            {
                request.Headers.TryAddWithoutValidation("Authorization", ResolveTemplateVariables(header.Value, automationEvent));
            }
            else
            {
                request.Headers.TryAddWithoutValidation(header.Key, ResolveTemplateVariables(header.Value, automationEvent));
            }
        }

        // Add request body for methods that support it
        if (!string.IsNullOrWhiteSpace(body) && method != "GET" && method != "HEAD" && method != "DELETE")
        {
            request.Content = new StringContent(body, Encoding.UTF8, contentType);
        }

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request);
        }
        catch (TaskCanceledException)
        {
            httpStopwatch.Stop();
            step.HttpResponseTimeMs = httpStopwatch.ElapsedMilliseconds;
            throw new TimeoutException($"HTTP request to {url} timed out after {timeoutSeconds}s");
        }
        catch (HttpRequestException ex)
        {
            httpStopwatch.Stop();
            step.HttpResponseTimeMs = httpStopwatch.ElapsedMilliseconds;
            throw new InvalidOperationException($"HTTP request to {url} failed: {ex.Message}", ex);
        }

        httpStopwatch.Stop();
        step.HttpResponseTimeMs = httpStopwatch.ElapsedMilliseconds;
        step.HttpResponseStatusCode = (int)response.StatusCode;

        // Capture response headers
        var responseHeaders = new Dictionary<string, string>();
        foreach (var header in response.Headers)
            responseHeaders[header.Key] = string.Join(", ", header.Value);
        if (response.Content?.Headers != null)
        {
            foreach (var header in response.Content.Headers)
                responseHeaders[header.Key] = string.Join(", ", header.Value);
        }
        step.HttpResponseHeaders = JsonSerializer.Serialize(responseHeaders, JsonOptions);

        // Capture response body (truncated)
        var responseBody = response.Content != null ? await response.Content.ReadAsStringAsync() : "";
        step.HttpResponseBody = responseBody.Length > MaxHttpResponseBodyLength
            ? responseBody[..MaxHttpResponseBodyLength] + "...[truncated]"
            : responseBody;

        step.OutputData = JsonSerializer.Serialize(new
        {
            statusCode = (int)response.StatusCode,
            reasonPhrase = response.ReasonPhrase,
            responseTimeMs = httpStopwatch.ElapsedMilliseconds,
            bodyLength = responseBody.Length
        }, JsonOptions);

        // Validate expected status codes
        if (!IsExpectedStatusCode((int)response.StatusCode, expectedStatusCodes))
        {
            throw new InvalidOperationException(
                $"HTTP {method} {url} returned {(int)response.StatusCode} {response.ReasonPhrase}, " +
                $"expected {expectedStatusCodes}. Response: {step.HttpResponseBody?[..Math.Min(step.HttpResponseBody.Length, 500)]}");
        }

        _logger.LogInformation(
            "HTTP Request completed: {Method} {Url} → {StatusCode} in {Ms}ms",
            method, url, (int)response.StatusCode, httpStopwatch.ElapsedMilliseconds);

        return $"HTTP {method} {url} → {(int)response.StatusCode} ({httpStopwatch.ElapsedMilliseconds}ms)";
    }

    /// <summary>
    /// Replaces template variables in a string with values from the automation event context.
    /// Supports: {{username}}, {{email}}, {{balance}}, {{userId}}, {{userUuid}}, and any context key.
    /// </summary>
    private static string ResolveTemplateVariables(string template, AutomationEvent automationEvent)
    {
        if (string.IsNullOrEmpty(template))
            return template;

        // Built-in variables
        template = template.Replace("{{username}}", automationEvent.RadiusUsername ?? "");
        template = template.Replace("{{userId}}", automationEvent.RadiusUserId.ToString());
        template = template.Replace("{{userUuid}}", automationEvent.RadiusUserUuid.ToString());
        template = template.Replace("{{triggeredBy}}", automationEvent.PerformedBy ?? "");
        template = template.Replace("{{triggerType}}", automationEvent.TriggerType);
        template = template.Replace("{{timestamp}}", automationEvent.OccurredAt.ToString("O"));

        // Context variables: {{contextKey}}
        foreach (var kvp in automationEvent.Context)
        {
            var placeholder = $"{{{{{kvp.Key}}}}}";
            var value = kvp.Value switch
            {
                null => "",
                JsonElement je => je.ValueKind switch
                {
                    JsonValueKind.String => je.GetString() ?? "",
                    JsonValueKind.Number => je.GetRawText(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => je.GetRawText()
                },
                _ => kvp.Value.ToString() ?? ""
            };
            template = template.Replace(placeholder, value);
        }

        return template;
    }

    /// <summary>
    /// Validates if a status code matches the expected pattern (e.g., "200-299", "200,201,204").
    /// </summary>
    private static bool IsExpectedStatusCode(int statusCode, string expectedPattern)
    {
        if (string.IsNullOrWhiteSpace(expectedPattern))
            return true;

        foreach (var part in expectedPattern.Split(',', StringSplitOptions.TrimEntries))
        {
            if (part.Contains('-'))
            {
                var range = part.Split('-');
                if (range.Length == 2 && int.TryParse(range[0], out var min) && int.TryParse(range[1], out var max))
                {
                    if (statusCode >= min && statusCode <= max)
                        return true;
                }
            }
            else if (int.TryParse(part, out var exact))
            {
                if (statusCode == exact)
                    return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Evaluates a condition node to determine which branch to follow.
    /// </summary>
    private bool EvaluateCondition(WorkflowNode conditionNode, AutomationEvent automationEvent)
    {
        var conditionType = conditionNode.Data?.ConditionType;

        switch (conditionType)
        {
            case "balance-check":
                if (automationEvent.Context.TryGetValue("balance", out var balanceObj) && balanceObj is JsonElement balanceEl)
                {
                    var balance = balanceEl.GetDecimal();
                    return balance > 0;
                }
                return false;

            case "user-status":
                if (automationEvent.Context.TryGetValue("enabled", out var enabledObj) && enabledObj is JsonElement enabledEl)
                {
                    return enabledEl.GetBoolean();
                }
                return true;

            case "date-check":
                if (automationEvent.Context.TryGetValue("expiration", out var expObj) && expObj is JsonElement expEl)
                {
                    var expString = expEl.GetString();
                    if (DateTime.TryParse(expString, out var expiration))
                        return expiration > DateTime.UtcNow;
                }
                return true;

            default:
                _logger.LogWarning("Unknown condition type: {ConditionType}, defaulting to true", conditionType);
                return true;
        }
    }

    /// <summary>
    /// Suspends a RADIUS user by setting Enabled = false.
    /// </summary>
    private async Task SuspendUserAsync(int radiusUserId, ApplicationDbContext dbContext)
    {
        var user = await dbContext.RadiusUsers.FindAsync(radiusUserId);
        if (user != null)
        {
            user.Enabled = false;
            user.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            _logger.LogInformation("Suspended RADIUS user {Username} (ID: {Id})", user.Username, user.Id);
        }
    }

    /// <summary>
    /// Creates a new execution step linked to the current execution context.
    /// </summary>
    private static AutomationExecutionStep CreateStep(
        ExecutionContext ctx, WorkflowNode node, string nodeType, string? subType)
    {
        return new AutomationExecutionStep
        {
            ExecutionLogId = ctx.ExecutionLog.Id,
            StepOrder = ctx.StepOrder,
            NodeId = node.Id,
            NodeType = nodeType,
            NodeSubType = subType,
            NodeLabel = node.Data?.Label,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Builds a human-readable result summary for the execution log.
    /// </summary>
    private static string BuildResultSummary(AutomationExecutionLog log)
    {
        var parts = new List<string>();
        parts.Add($"{log.NodesVisited} nodes visited");
        
        if (log.ActionsExecuted > 0)
        {
            parts.Add($"{log.ActionsSucceeded}/{log.ActionsExecuted} actions succeeded");
            if (log.ActionsFailed > 0)
                parts.Add($"{log.ActionsFailed} failed");
        }
        
        if (log.ConditionsEvaluated > 0)
            parts.Add($"{log.ConditionsEvaluated} conditions evaluated");
        
        parts.Add($"completed in {log.ExecutionTimeMs}ms");
        
        return string.Join(", ", parts);
    }

    /// <summary>
    /// Internal execution context passed through the traversal.
    /// </summary>
    private class ExecutionContext
    {
        public AutomationExecutionLog ExecutionLog { get; set; } = null!;
        public int StepOrder { get; set; }
        public AutomationEvent AutomationEvent { get; set; } = null!;
        public ApplicationDbContext DbContext { get; set; } = null!;
    }
}

#region Workflow JSON Deserialization Models

/// <summary>
/// Represents the deserialized ReactFlow workflow definition stored in Automation.WorkflowJson.
/// </summary>
public class WorkflowDefinition
{
    public List<WorkflowNode>? Nodes { get; set; }
    public List<WorkflowEdge>? Edges { get; set; }
    public WorkflowViewport? Viewport { get; set; }
}

public class WorkflowNode
{
    public string Id { get; set; } = null!;
    public string? Type { get; set; }
    public WorkflowNodeData? Data { get; set; }
    public WorkflowPosition? Position { get; set; }
}

public class WorkflowNodeData
{
    public string? Label { get; set; }
    public string? Description { get; set; }
    public string? TriggerType { get; set; }
    public string? ActionType { get; set; }
    public string? ConditionType { get; set; }
    public string? CommentType { get; set; }
    public string? Text { get; set; }
    
    // HTTP Request fields
    public string? HttpMethod { get; set; }
    public string? HttpUrl { get; set; }
    public string? HttpHeaders { get; set; }
    public string? HttpBody { get; set; }
    public string? HttpContentType { get; set; }
    public string? HttpExpectedStatusCodes { get; set; }
    public int? HttpTimeoutSeconds { get; set; }
}

public class WorkflowPosition
{
    public double X { get; set; }
    public double Y { get; set; }
}

public class WorkflowEdge
{
    public string Id { get; set; } = null!;
    public string Source { get; set; } = null!;
    public string Target { get; set; } = null!;
    public string? SourceHandle { get; set; }
    public string? TargetHandle { get; set; }
}

public class WorkflowViewport
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Zoom { get; set; }
}

#endregion
