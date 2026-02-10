namespace Backend.Helpers;

/// <summary>
/// Marks a controller action with custom audit metadata. When applied, the
/// automatic AuditActionFilter uses these values instead of inferring them.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class AuditAttribute : Attribute
{
    /// <summary>Override the audit action (Create, Update, Delete, Activate, etc.)</summary>
    public string? Action { get; set; }

    /// <summary>Override the entity type (RadiusUser, BillingProfile, etc.)</summary>
    public string? EntityType { get; set; }

    /// <summary>Override the category (Billing, Network, UserManagement, etc.)</summary>
    public string? Category { get; set; }

    /// <summary>Custom description template. {action} and {entity} are replaced.</summary>
    public string? Description { get; set; }
}

/// <summary>
/// Excludes a controller or action from automatic audit logging.
/// Use on read-only endpoints, health checks, or high-frequency queries.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class NoAuditAttribute : Attribute { }
