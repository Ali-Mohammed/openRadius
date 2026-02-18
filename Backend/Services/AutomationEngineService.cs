using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Text.Json;

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
}

/// <summary>
/// Automation engine that processes workflow automations when domain events fire.
/// 
/// Workflow evaluation:
/// 1. Find all active automations (status = "active", isActive = true)
/// 2. Parse each automation's WorkflowJson to find trigger nodes
/// 3. Match trigger nodes against the fired event type
/// 4. For matched automations, traverse the workflow graph (trigger → actions/conditions)
/// 5. Execute action nodes and evaluate condition nodes
/// 6. Log execution results in AutomationExecutionLogs
/// </summary>
public class AutomationEngineService : IAutomationEngineService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AutomationEngineService> _logger;

    public AutomationEngineService(
        ApplicationDbContext context,
        ILogger<AutomationEngineService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task FireEventAsync(AutomationEvent automationEvent)
    {
        try
        {
            _logger.LogInformation(
                "Automation event fired: {EventType} for user {Username} (ID: {UserId})",
                automationEvent.TriggerType,
                automationEvent.RadiusUsername,
                automationEvent.RadiusUserId);

            // Find all active automations with workflow definitions
            var activeAutomations = await _context.Automations
                .Where(a => a.Status == "active" && a.IsActive && !a.IsDeleted && a.WorkflowJson != null)
                .ToListAsync();

            if (!activeAutomations.Any())
            {
                _logger.LogDebug("No active automations found to evaluate");
                return;
            }

            _logger.LogInformation("Found {Count} active automations to evaluate", activeAutomations.Count);

            foreach (var automation in activeAutomations)
            {
                await EvaluateAutomationAsync(automation, automationEvent);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing automation event {EventType}", automationEvent.TriggerType);
        }
    }

    /// <summary>
    /// Evaluates a single automation's workflow against the fired event.
    /// </summary>
    private async Task EvaluateAutomationAsync(Automation automation, AutomationEvent automationEvent)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            if (string.IsNullOrEmpty(automation.WorkflowJson))
            {
                _logger.LogDebug("Automation {Id} has no workflow definition, skipping", automation.Id);
                return;
            }

            // Parse the workflow JSON (same format as ReactFlow: { nodes: [], edges: [] })
            var workflow = JsonSerializer.Deserialize<WorkflowDefinition>(automation.WorkflowJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (workflow?.Nodes == null || !workflow.Nodes.Any())
            {
                _logger.LogDebug("Automation {Id} has no nodes, skipping", automation.Id);
                return;
            }

            // Find trigger nodes that match the event type
            var matchingTriggers = workflow.Nodes
                .Where(n => n.Type == "trigger" && n.Data?.TriggerType == automationEvent.TriggerType)
                .ToList();

            if (!matchingTriggers.Any())
            {
                _logger.LogDebug(
                    "Automation {Id} ({Title}) has no trigger matching {TriggerType}, skipping",
                    automation.Id, automation.Title, automationEvent.TriggerType);
                return;
            }

            _logger.LogInformation(
                "Automation {Id} ({Title}) matched event {TriggerType} with {TriggerCount} trigger(s)",
                automation.Id, automation.Title, automationEvent.TriggerType, matchingTriggers.Count);

            // Create execution log
            var executionLog = new AutomationExecutionLog
            {
                AutomationId = automation.Id,
                TriggerType = automationEvent.TriggerType,
                RadiusUserId = automationEvent.RadiusUserId,
                RadiusUsername = automationEvent.RadiusUsername,
                Status = "started",
                EventData = JsonSerializer.Serialize(automationEvent.Context),
                TriggeredBy = automationEvent.PerformedBy,
                CreatedAt = DateTime.UtcNow
            };

            _context.AutomationExecutionLogs.Add(executionLog);
            await _context.SaveChangesAsync();

            // Traverse the workflow from each matching trigger
            var actionsExecuted = 0;
            var actionResults = new List<string>();

            foreach (var trigger in matchingTriggers)
            {
                var result = await TraverseFromNodeAsync(
                    trigger, workflow, automationEvent, actionResults);
                actionsExecuted += result;
            }

            // Update execution log with results
            stopwatch.Stop();
            executionLog.Status = "completed";
            executionLog.ActionsExecuted = actionsExecuted;
            executionLog.ExecutionTimeMs = stopwatch.ElapsedMilliseconds;
            executionLog.Result = actionsExecuted > 0
                ? $"Executed {actionsExecuted} action(s): {string.Join("; ", actionResults)}"
                : "No actions executed (no connected action nodes or conditions not met)";
            executionLog.CompletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Automation {Id} ({Title}) completed: {ActionsExecuted} actions in {ElapsedMs}ms",
                automation.Id, automation.Title, actionsExecuted, stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error evaluating automation {Id}", automation.Id);

            // Log the failure
            try
            {
                var failLog = new AutomationExecutionLog
                {
                    AutomationId = automation.Id,
                    TriggerType = automationEvent.TriggerType,
                    RadiusUserId = automationEvent.RadiusUserId,
                    RadiusUsername = automationEvent.RadiusUsername,
                    Status = "failed",
                    ErrorMessage = ex.Message,
                    EventData = JsonSerializer.Serialize(automationEvent.Context),
                    TriggeredBy = automationEvent.PerformedBy,
                    ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                    CreatedAt = DateTime.UtcNow,
                    CompletedAt = DateTime.UtcNow
                };

                _context.AutomationExecutionLogs.Add(failLog);
                await _context.SaveChangesAsync();
            }
            catch (Exception logEx)
            {
                _logger.LogError(logEx, "Failed to log automation execution failure for automation {Id}", automation.Id);
            }
        }
    }

    /// <summary>
    /// Traverses the workflow graph starting from a node, following edges to execute
    /// connected action and condition nodes.
    /// </summary>
    /// <returns>Number of actions executed from this node.</returns>
    private async Task<int> TraverseFromNodeAsync(
        WorkflowNode currentNode,
        WorkflowDefinition workflow,
        AutomationEvent automationEvent,
        List<string> actionResults)
    {
        var actionsExecuted = 0;

        // Find all edges originating from this node
        var outgoingEdges = workflow.Edges?
            .Where(e => e.Source == currentNode.Id)
            .ToList() ?? new List<WorkflowEdge>();

        if (!outgoingEdges.Any())
        {
            _logger.LogDebug("No outgoing edges from node {NodeId}", currentNode.Id);
            return 0;
        }

        foreach (var edge in outgoingEdges)
        {
            var targetNode = workflow.Nodes?.FirstOrDefault(n => n.Id == edge.Target);
            if (targetNode == null) continue;

            switch (targetNode.Type)
            {
                case "action":
                    var result = await ExecuteActionNodeAsync(targetNode, automationEvent);
                    if (result != null)
                    {
                        actionsExecuted++;
                        actionResults.Add(result);
                    }
                    // Continue traversing after action node
                    actionsExecuted += await TraverseFromNodeAsync(targetNode, workflow, automationEvent, actionResults);
                    break;

                case "condition":
                    var conditionMet = EvaluateConditionNode(targetNode, automationEvent);
                    
                    // Find edges from condition node - "true" or "false" handle IDs
                    var conditionEdges = workflow.Edges?
                        .Where(e => e.Source == targetNode.Id)
                        .ToList() ?? new List<WorkflowEdge>();

                    foreach (var condEdge in conditionEdges)
                    {
                        // Check if edge originates from the true or false handle
                        var isTrue = condEdge.SourceHandle == "true" || condEdge.SourceHandle == null;
                        var isFalse = condEdge.SourceHandle == "false";

                        if ((conditionMet && isTrue) || (!conditionMet && isFalse))
                        {
                            var condTargetNode = workflow.Nodes?.FirstOrDefault(n => n.Id == condEdge.Target);
                            if (condTargetNode != null)
                            {
                                if (condTargetNode.Type == "action")
                                {
                                    var actionResult = await ExecuteActionNodeAsync(condTargetNode, automationEvent);
                                    if (actionResult != null)
                                    {
                                        actionsExecuted++;
                                        actionResults.Add(actionResult);
                                    }
                                    actionsExecuted += await TraverseFromNodeAsync(condTargetNode, workflow, automationEvent, actionResults);
                                }
                                else
                                {
                                    actionsExecuted += await TraverseFromNodeAsync(condTargetNode, workflow, automationEvent, actionResults);
                                }
                            }
                        }
                    }
                    break;

                case "comment":
                    // Comments are documentation only, skip but continue traversal
                    actionsExecuted += await TraverseFromNodeAsync(targetNode, workflow, automationEvent, actionResults);
                    break;
            }
        }

        return actionsExecuted;
    }

    /// <summary>
    /// Executes an action node (send-email, send-notification, credit-wallet, etc.)
    /// Returns a description of the action taken, or null if skipped.
    /// </summary>
    private async Task<string?> ExecuteActionNodeAsync(WorkflowNode actionNode, AutomationEvent automationEvent)
    {
        var actionType = actionNode.Data?.ActionType;
        var label = actionNode.Data?.Label ?? actionType ?? "Unknown";

        _logger.LogInformation(
            "Executing action: {ActionType} ({Label}) for user {Username}",
            actionType, label, automationEvent.RadiusUsername);

        try
        {
            switch (actionType)
            {
                case "send-email":
                    // TODO: Integrate with email service when available
                    _logger.LogInformation(
                        "Action: Send email to user {Username} ({Email})",
                        automationEvent.RadiusUsername,
                        automationEvent.Context.GetValueOrDefault("email"));
                    return $"Send email to {automationEvent.RadiusUsername}";

                case "send-notification":
                    // TODO: Integrate with notification/SignalR hub
                    _logger.LogInformation(
                        "Action: Send notification for user {Username}",
                        automationEvent.RadiusUsername);
                    return $"Send notification for {automationEvent.RadiusUsername}";

                case "credit-wallet":
                    // TODO: Integrate with wallet service
                    _logger.LogInformation(
                        "Action: Credit wallet for user {Username}",
                        automationEvent.RadiusUsername);
                    return $"Credit wallet for {automationEvent.RadiusUsername}";

                case "debit-wallet":
                    _logger.LogInformation(
                        "Action: Debit wallet for user {Username}",
                        automationEvent.RadiusUsername);
                    return $"Debit wallet for {automationEvent.RadiusUsername}";

                case "suspend-user":
                    await SuspendUserAsync(automationEvent.RadiusUserId);
                    return $"Suspended user {automationEvent.RadiusUsername}";

                case "apply-discount":
                    _logger.LogInformation(
                        "Action: Apply discount for user {Username}",
                        automationEvent.RadiusUsername);
                    return $"Apply discount for {automationEvent.RadiusUsername}";

                case "update-profile":
                    _logger.LogInformation(
                        "Action: Update profile for user {Username}",
                        automationEvent.RadiusUsername);
                    return $"Update profile for {automationEvent.RadiusUsername}";

                default:
                    _logger.LogWarning("Unknown action type: {ActionType}", actionType);
                    return $"Unknown action: {actionType}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing action {ActionType} for user {Username}",
                actionType, automationEvent.RadiusUsername);
            return $"Failed: {actionType} - {ex.Message}";
        }
    }

    /// <summary>
    /// Evaluates a condition node to determine which branch to follow.
    /// </summary>
    private bool EvaluateConditionNode(WorkflowNode conditionNode, AutomationEvent automationEvent)
    {
        var conditionType = conditionNode.Data?.ConditionType;

        _logger.LogInformation(
            "Evaluating condition: {ConditionType} for user {Username}",
            conditionType, automationEvent.RadiusUsername);

        switch (conditionType)
        {
            case "balance-check":
                if (automationEvent.Context.TryGetValue("balance", out var balanceObj) && balanceObj is JsonElement balanceEl)
                {
                    var balance = balanceEl.GetDecimal();
                    _logger.LogInformation("Balance check: {Balance}", balance);
                    return balance > 0;
                }
                return false;

            case "user-status":
                if (automationEvent.Context.TryGetValue("enabled", out var enabledObj) && enabledObj is JsonElement enabledEl)
                {
                    var enabled = enabledEl.GetBoolean();
                    _logger.LogInformation("User status check: Enabled={Enabled}", enabled);
                    return enabled;
                }
                return true;

            case "date-check":
                if (automationEvent.Context.TryGetValue("expiration", out var expObj) && expObj is JsonElement expEl)
                {
                    var expString = expEl.GetString();
                    if (DateTime.TryParse(expString, out var expiration))
                    {
                        var isNotExpired = expiration > DateTime.UtcNow;
                        _logger.LogInformation("Date check: Expiration={Expiration}, NotExpired={NotExpired}", expiration, isNotExpired);
                        return isNotExpired;
                    }
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
    private async Task SuspendUserAsync(int radiusUserId)
    {
        var user = await _context.RadiusUsers.FindAsync(radiusUserId);
        if (user != null)
        {
            user.Enabled = false;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Suspended RADIUS user {Username} (ID: {Id})", user.Username, user.Id);
        }
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
