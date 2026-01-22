namespace Backend.Helpers;

/// <summary>
/// Constants for user role names used throughout the application
/// </summary>
public static class UserRoles
{
    /// <summary>
    /// Administrator role - full system access
    /// </summary>
    public const string Admin = "admin";

    /// <summary>
    /// Manager role - can manage resources and users within their scope
    /// </summary>
    public const string Manager = "manager";

    /// <summary>
    /// Agent role - can perform customer service operations
    /// </summary>
    public const string Agent = "agent";

    /// <summary>
    /// Billing role - can manage billing and payment operations
    /// </summary>
    public const string Billing = "billing";

    /// <summary>
    /// Standard user role - basic access
    /// </summary>
    public const string User = "user";

    /// <summary>
    /// All administrative roles that should bypass zone restrictions
    /// </summary>
    public static readonly string[] AdministrativeRoles = { Admin, Manager };
}
