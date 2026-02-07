namespace Backend.DTOs;

/// <summary>
/// Represents a navigation menu item returned to the frontend.
/// The menu tree is built on the backend and filtered by the current user's permissions.
/// </summary>
public class MenuItemDto
{
    /// <summary>
    /// Translation key used by the frontend i18n system (e.g. "navigation.radius")
    /// </summary>
    public string TitleKey { get; set; } = string.Empty;

    /// <summary>
    /// Route URL for navigation
    /// </summary>
    public string Url { get; set; } = "#";

    /// <summary>
    /// Lucide icon name (e.g. "LayoutDashboard", "Users", "CreditCard")
    /// </summary>
    public string Icon { get; set; } = string.Empty;

    /// <summary>
    /// Child menu items. Empty list means this is a leaf node.
    /// </summary>
    public List<MenuItemDto> Items { get; set; } = new();

    /// <summary>
    /// The permission key required to see this item (e.g. "radius.users.view").
    /// Null means the item is always visible to authenticated users.
    /// </summary>
    public string? RequiredPermission { get; set; }

    /// <summary>
    /// Whether this section should load its children dynamically (e.g. Dashboards)
    /// </summary>
    public bool IsDynamic { get; set; } = false;
}

/// <summary>
/// Full navigation response including the menu tree and the user's resolved permissions
/// </summary>
public class NavigationMenuResponse
{
    /// <summary>
    /// The filtered navigation menu items the current user is allowed to see
    /// </summary>
    public List<MenuItemDto> Menu { get; set; } = new();

    /// <summary>
    /// All permission keys the current user has (for frontend route guards)
    /// </summary>
    public List<string> Permissions { get; set; } = new();

    /// <summary>
    /// Whether the current user is a super admin (has full access)
    /// </summary>
    public bool IsSuperAdmin { get; set; }
}
