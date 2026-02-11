using Backend.Data;
using Backend.DTOs;
using Backend.Helpers;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Backend.Services;

/// <summary>
/// Builds the navigation menu tree and filters it based on the current user's
/// roles → permissions from the database. Keycloak admin roles grant full access
/// for backward compatibility.
/// </summary>
public class NavigationService : INavigationService
{
    private readonly MasterDbContext _context;
    private readonly ILogger<NavigationService> _logger;

    // Keycloak realm roles that grant full admin access
    private static readonly HashSet<string> AdminRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "admin",
        "administrator",
        "super-administrator",
        "Super Administrator"
    };

    public NavigationService(MasterDbContext context, ILogger<NavigationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<NavigationMenuResponse> GetNavigationMenuAsync(ClaimsPrincipal user)
    {
        var systemUserId = user.GetSystemUserId();
        var isSuperAdmin = IsKeycloakAdmin(user);

        _logger.LogInformation(
            "Building navigation menu for SystemUserId={SystemUserId}, IsSuperAdmin={IsSuperAdmin}",
            systemUserId, isSuperAdmin);

        // Get user's permissions from database (User → UserRoles → Role → RolePermissions → Permission)
        var userPermissions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (systemUserId.HasValue)
        {
            var permissions = await _context.UserRoles
                .Where(ur => ur.UserId == systemUserId.Value)
                .SelectMany(ur => ur.Role.RolePermissions)
                .Where(rp => !rp.Permission.IsDeleted && !rp.Role.IsDeleted)
                .Select(rp => rp.Permission.Name)
                .Distinct()
                .ToListAsync();

            foreach (var p in permissions)
                userPermissions.Add(p);

            _logger.LogInformation(
                "User {SystemUserId} has {Count} permissions: [{Permissions}]",
                systemUserId.Value, permissions.Count, string.Join(", ", permissions));
        }

        // Build the full menu tree
        var fullMenu = BuildFullMenuTree();

        // Filter the menu
        List<MenuItemDto> filteredMenu;

        if (isSuperAdmin)
        {
            // Super admins see everything
            filteredMenu = fullMenu;
            _logger.LogInformation("Super admin — returning full menu ({Count} sections)", filteredMenu.Count);
        }
        else if (userPermissions.Count == 0 && systemUserId.HasValue)
        {
            // User has no permissions assigned — show only the dashboard
            filteredMenu = fullMenu
                .Where(m => m.TitleKey == "navigation.dashboards")
                .ToList();
            _logger.LogInformation(
                "User {SystemUserId} has no permissions assigned — returning dashboard-only menu",
                systemUserId.Value);
        }
        else
        {
            // Filter menu based on permissions
            filteredMenu = FilterMenu(fullMenu, userPermissions);
            _logger.LogInformation(
                "Filtered menu to {Count} sections for user {SystemUserId}",
                filteredMenu.Count, systemUserId);
        }

        return new NavigationMenuResponse
        {
            Menu = filteredMenu,
            Permissions = userPermissions.ToList(),
            IsSuperAdmin = isSuperAdmin
        };
    }

    /// <summary>
    /// Checks if the user has an admin role in Keycloak realm_access claims
    /// </summary>
    private static bool IsKeycloakAdmin(ClaimsPrincipal user)
    {
        // Check realm roles from Keycloak token
        var realmRoles = user.FindAll("realm_access")
            .SelectMany(c =>
            {
                try
                {
                    var json = System.Text.Json.JsonDocument.Parse(c.Value);
                    if (json.RootElement.TryGetProperty("roles", out var roles))
                    {
                        return roles.EnumerateArray().Select(r => r.GetString() ?? "");
                    }
                }
                catch { }
                return Enumerable.Empty<string>();
            });

        if (realmRoles.Any(r => AdminRoles.Contains(r)))
            return true;

        // Also check role claims directly (some OIDC providers put roles as individual claims)
        var roleClaims = user.FindAll(ClaimTypes.Role).Select(c => c.Value)
            .Concat(user.FindAll("role").Select(c => c.Value));

        return roleClaims.Any(r => AdminRoles.Contains(r));
    }

    /// <summary>
    /// Filters the menu tree: keeps items where the user has the required permission.
    /// For sections (parent items), keeps them if at least one child is visible.
    /// </summary>
    private static List<MenuItemDto> FilterMenu(List<MenuItemDto> menu, HashSet<string> permissions)
    {
        var result = new List<MenuItemDto>();

        foreach (var section in menu)
        {
            if (section.Items.Count == 0)
            {
                // Leaf node — check its own permission
                if (section.RequiredPermission == null || permissions.Contains(section.RequiredPermission))
                    result.Add(section);
                continue;
            }

            // Section with children — filter children
            var visibleChildren = new List<MenuItemDto>();
            foreach (var child in section.Items)
            {
                if (child.RequiredPermission == null || permissions.Contains(child.RequiredPermission))
                    visibleChildren.Add(child);
            }

            // Only include the section if it has visible children
            if (visibleChildren.Count > 0)
            {
                result.Add(new MenuItemDto
                {
                    TitleKey = section.TitleKey,
                    Url = section.Url,
                    Icon = section.Icon,
                    IsDynamic = section.IsDynamic,
                    RequiredPermission = section.RequiredPermission,
                    Items = visibleChildren
                });
            }
        }

        return result;
    }

    /// <summary>
    /// Defines the complete navigation menu tree with permission mappings.
    /// This is the single source of truth for the application menu structure.
    /// Permission keys follow the pattern: "section.subsection.action"
    /// </summary>
    private static List<MenuItemDto> BuildFullMenuTree()
    {
        return new List<MenuItemDto>
        {
            // ── Dashboards ──────────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.dashboards",
                Url = "/dashboards",
                Icon = "LayoutDashboard",
                IsDynamic = true,
                RequiredPermission = "dashboard.view",
                Items = new List<MenuItemDto>() // Populated dynamically by frontend
            },

            // ── RADIUS ──────────────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.radius",
                Url = "#",
                Icon = "LayoutDashboard",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.users", Url = "/radius/users", Icon = "Users", RequiredPermission = "radius.users.view" },
                    new() { TitleKey = "navigation.profiles", Url = "/radius/profiles", Icon = "CircleUser", RequiredPermission = "radius.profiles.view" },
                    new() { TitleKey = "navigation.groups", Url = "/radius/groups", Icon = "UsersRound", RequiredPermission = "radius.groups.view" },
                    new() { TitleKey = "navigation.tags", Url = "/radius/tags", Icon = "Tag", RequiredPermission = "radius.tags.view" },
                    new() { TitleKey = "navigation.nas", Url = "/radius/nas", Icon = "Server", RequiredPermission = "radius.nas.view" },
                    new() { TitleKey = "navigation.ipPools", Url = "/radius/ip-pools", Icon = "Network", RequiredPermission = "radius.ip-pools.view" },
                    new() { TitleKey = "navigation.ipReservations", Url = "/radius/ip-reservations", Icon = "Layers", RequiredPermission = "radius.ip-reservations.view" },
                    new() { TitleKey = "navigation.customAttributes", Url = "/radius/custom-attributes", Icon = "Settings", RequiredPermission = "radius.custom-attributes.view" },
                    new() { TitleKey = "navigation.zones", Url = "/radius/zones", Icon = "MapPin", RequiredPermission = "radius.zones.view" },
                    new() { TitleKey = "navigation.activations", Url = "/radius/activations", Icon = "Activity", RequiredPermission = "radius.activations.view" },
                }
            },

            // ── Billing ─────────────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.billing",
                Url = "#",
                Icon = "CreditCard",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.billingProfiles", Url = "/billing/profiles", Icon = "FileText", RequiredPermission = "billing.profiles.view" },
                    new() { TitleKey = "navigation.activations", Url = "/billing/activations", Icon = "History", RequiredPermission = "billing.activations.view" },
                    new() { TitleKey = "navigation.addons", Url = "/billing/addons", Icon = "Package", RequiredPermission = "billing.addons.view" },
                    new() { TitleKey = "navigation.groups", Url = "/billing/groups", Icon = "TrendingUp", RequiredPermission = "billing.groups.view" },
                    new() { TitleKey = "navigation.cashbacks", Url = "/billing/cashbacks", Icon = "Gift", RequiredPermission = "billing.cashbacks.view" },
                    new() { TitleKey = "navigation.cashbackGroups", Url = "/billing/cashback-groups", Icon = "PiggyBank", RequiredPermission = "billing.cashback-groups.view" },
                    new() { TitleKey = "navigation.subAgentCashbacks", Url = "/billing/sub-agent-cashbacks", Icon = "UsersRound", RequiredPermission = "billing.sub-agent-cashbacks.view" },
                    new() { TitleKey = "navigation.customWallets", Url = "/billing/wallets", Icon = "Wallet", RequiredPermission = "billing.wallets.view" },
                    new() { TitleKey = "navigation.userWallets", Url = "/billing/user-wallets", Icon = "WalletCards", RequiredPermission = "billing.user-wallets.view" },
                    new() { TitleKey = "navigation.topUp", Url = "/billing/topup", Icon = "ArrowUpCircle", RequiredPermission = "billing.topup.view" },
                    new() { TitleKey = "navigation.walletHistory", Url = "/billing/history", Icon = "History", RequiredPermission = "billing.history.view" },
                    new() { TitleKey = "navigation.transactions", Url = "/billing/transactions", Icon = "Receipt", RequiredPermission = "billing.transactions.view" },
                    new() { TitleKey = "navigation.balances", Url = "/billing/balances", Icon = "Coins", RequiredPermission = "billing.balances.view" },
                    new() { TitleKey = "navigation.automations", Url = "/billing/automations", Icon = "Zap", RequiredPermission = "billing.automations.view" },
                }
            },

            // ── Network ─────────────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.network",
                Url = "#",
                Icon = "Antenna",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.olts", Url = "/network/olts", Icon = "Cable", RequiredPermission = "network.olts.view" },
                    new() { TitleKey = "navigation.fdts", Url = "/network/fdts", Icon = "Box", RequiredPermission = "network.fdts.view" },
                    new() { TitleKey = "navigation.fats", Url = "/network/fats", Icon = "SquareStack", RequiredPermission = "network.fats.view" },
                    new() { TitleKey = "navigation.provisioning", Url = "/network/provisioning", Icon = "Globe", RequiredPermission = "network.provisioning.view" },
                    new() { TitleKey = "navigation.monitoring", Url = "/network/monitoring", Icon = "Monitor", RequiredPermission = "network.monitoring.view" },
                    new() { TitleKey = "navigation.networkReports", Url = "/network/reports", Icon = "BarChart3", RequiredPermission = "network.reports.view" },
                    new() { TitleKey = "navigation.networkSettings", Url = "/network/settings", Icon = "Cog", RequiredPermission = "network.settings.view" },
                }
            },

            // ── Connectors ──────────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.connectors",
                Url = "#",
                Icon = "Database",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.connectorList", Url = "/connectors", Icon = "FileStack", RequiredPermission = "connectors.list.view" },
                    new() { TitleKey = "navigation.cdcMonitor", Url = "/cdc-monitor", Icon = "Activity", RequiredPermission = "connectors.cdc-monitor.view" },
                    new() { TitleKey = "navigation.connectorSettings", Url = "/connectors/settings", Icon = "Wrench", RequiredPermission = "connectors.settings.view" },
                }
            },

            // ── Microservices ───────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.microservices",
                Url = "#",
                Icon = "Server",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.radiusSyncService", Url = "/microservices/radius-sync", Icon = "RefreshCcw", RequiredPermission = "microservices.radius-sync.view" },
                }
            },

            // ── App Settings ────────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.appSetting",
                Url = "#",
                Icon = "SlidersHorizontal",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.workspace", Url = "/workspace/view", Icon = "Eye", RequiredPermission = "workspace.view" },
                    new() { TitleKey = "navigation.serverMonitoring", Url = "/workspace/server-monitoring", Icon = "Container", RequiredPermission = "server-monitoring.view" },
                    new() { TitleKey = "navigation.auditLogs", Url = "/audit-logs", Icon = "ScrollText", RequiredPermission = "audit.view" },
                    new() { TitleKey = "navigation.general", Url = "/settings/general", Icon = "DollarSign", RequiredPermission = "settings.general.view" },
                    new() { TitleKey = "navigation.paymentInformation", Url = "/settings/payment-history", Icon = "CreditCard", RequiredPermission = "settings.payment-history.view" },
                    new() { TitleKey = "navigation.oidc", Url = "/settings/oidc", Icon = "Key", RequiredPermission = "settings.oidc.view" },
                    new() { TitleKey = "navigation.databaseBackup", Url = "/settings/database-backup", Icon = "HardDrive", RequiredPermission = "settings.database-backup.view" },
                    new() { TitleKey = "navigation.systemUpdate", Url = "/settings/system-update", Icon = "RefreshCcw", RequiredPermission = "settings.system-update.view" },
                    new() { TitleKey = "navigation.integrations", Url = "/integrations", Icon = "Radio", RequiredPermission = "settings.integrations.view" },
                    new() { TitleKey = "navigation.developer", Url = "/settings/general?tab=developer", Icon = "Code", RequiredPermission = "settings.developer.view" },
                }
            },

            // ── User Management ─────────────────────────────────────
            new MenuItemDto
            {
                TitleKey = "navigation.userManagement",
                Url = "#",
                Icon = "UserCog",
                Items = new List<MenuItemDto>
                {
                    new() { TitleKey = "navigation.users", Url = "/users", Icon = "UserCheck", RequiredPermission = "users.view" },
                    new() { TitleKey = "navigation.roles", Url = "/roles", Icon = "Shield", RequiredPermission = "roles.view" },
                    new() { TitleKey = "navigation.permissions", Url = "/permissions", Icon = "Lock", RequiredPermission = "permissions.view" },
                    new() { TitleKey = "navigation.userGroups", Url = "/groups", Icon = "UserRound", RequiredPermission = "groups.view" },
                }
            },
        };
    }
}
