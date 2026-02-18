namespace Backend.Configuration;

/// <summary>
/// Centralized mapping of API route patterns → required permissions.
/// The <see cref="PermissionAuthorizationFilter"/> reads this map
/// to enforce granular permissions on every endpoint automatically.
///
/// Format: ("HTTP_METHOD ROUTE_PATTERN", "required.permission")
///   • Route patterns support {id}, {uuid}, and * wildcards.
///   • Multiple HTTP methods can share the same permission.
///   • Super-admin / Keycloak admin bypass is handled by the filter.
///
/// Ordering: More-specific patterns must appear BEFORE catch-all patterns.
/// </summary>
public static class PermissionRouteMap
{
    /// <summary>
    /// Returns all route → permission mappings for the application.
    /// </summary>
    public static List<RoutePermissionEntry> GetMappings()
    {
        return new List<RoutePermissionEntry>
        {
            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Users
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/radius/users/export/excel",            "radius.users.export"),
            new("GET",    "api/radius/users/trash",                   "radius.users.view"),
            new("POST",   "api/radius/users/bulk-delete",             "radius.users.delete"),
            new("POST",   "api/radius/users/bulk-restore",            "radius.users.delete"),
            new("POST",   "api/radius/users/bulk-renew",              "radius.users.update"),
            new("POST",   "api/radius/users/sync",                    "radius.users.update"),
            new("GET",    "api/radius/users/*/sessions",              "radius.users.view"),
            new("GET",    "api/radius/users/*/traffic",               "radius.users.view"),
            new("POST",   "api/radius/users/*/restore",               "radius.users.delete"),
            new("POST",   "api/radius/users/*/zone",                  "radius.users.update"),
            new("GET",    "api/radius/users/*",                       "radius.users.view"),
            new("PUT",    "api/radius/users/*/change-username",       "radius.users.update"),
            new("PUT",    "api/radius/users/*",                       "radius.users.update"),
            new("DELETE", "api/radius/users/*",                       "radius.users.delete"),
            new("GET",    "api/radius/users",                         "radius.users.view"),
            new("POST",   "api/radius/users",                         "radius.users.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Profiles
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/radius/profiles/trash",                "radius.profiles.view"),
            new("POST",   "api/radius/profiles/sync",                 "radius.profiles.update"),
            new("POST",   "api/radius/profiles/*/restore",            "radius.profiles.delete"),
            new("GET",    "api/radius/profiles/*",                    "radius.profiles.view"),
            new("PUT",    "api/radius/profiles/*",                    "radius.profiles.update"),
            new("DELETE", "api/radius/profiles/*",                    "radius.profiles.delete"),
            new("GET",    "api/radius/profiles",                      "radius.profiles.view"),
            new("POST",   "api/radius/profiles",                      "radius.profiles.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Groups
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/radius/groups/trash",                  "radius.groups.view"),
            new("POST",   "api/radius/groups/*/restore",              "radius.groups.delete"),
            new("GET",    "api/radius/groups/*",                      "radius.groups.view"),
            new("PUT",    "api/radius/groups/*",                      "radius.groups.update"),
            new("DELETE", "api/radius/groups/*",                      "radius.groups.delete"),
            new("GET",    "api/radius/groups",                        "radius.groups.view"),
            new("POST",   "api/radius/groups",                        "radius.groups.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Tags
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/radius/tags/sync",                     "radius.tags.update"),
            new("POST",   "api/radius/tags/sync-with-rules",          "radius.tags.update"),
            new("POST",   "api/radius/tags/*/restore",                "radius.tags.delete"),
            new("GET",    "api/radius/tags/*/users",                  "radius.tags.view"),
            new("GET",    "api/radius/tags/*",                        "radius.tags.view"),
            new("PUT",    "api/radius/tags/*",                        "radius.tags.update"),
            new("DELETE", "api/radius/tags/*",                        "radius.tags.delete"),
            new("GET",    "api/radius/tags",                          "radius.tags.view"),
            new("POST",   "api/radius/tags",                          "radius.tags.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — NAS
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/radius/nas/trash",                     "radius.nas.view"),
            new("GET",    "api/radius/nas/*/freeradius",              "radius.nas.view"),
            new("POST",   "api/radius/nas/*/restore",                 "radius.nas.delete"),
            new("GET",    "api/radius/nas/*",                         "radius.nas.view"),
            new("PUT",    "api/radius/nas/*",                         "radius.nas.update"),
            new("DELETE", "api/radius/nas/*",                         "radius.nas.delete"),
            new("GET",    "api/radius/nas",                           "radius.nas.view"),
            new("POST",   "api/radius/nas",                           "radius.nas.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — IP Pools
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/radius/ip-pools/trash",                "radius.ip-pools.view"),
            new("POST",   "api/radius/ip-pools/*/restore",            "radius.ip-pools.delete"),
            new("GET",    "api/radius/ip-pools/*",                    "radius.ip-pools.view"),
            new("PUT",    "api/radius/ip-pools/*",                    "radius.ip-pools.update"),
            new("DELETE", "api/radius/ip-pools/*",                    "radius.ip-pools.delete"),
            new("GET",    "api/radius/ip-pools",                      "radius.ip-pools.view"),
            new("POST",   "api/radius/ip-pools",                      "radius.ip-pools.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — IP Reservations
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/radius/ip-reservations/bulk-delete",   "radius.ip-reservations.delete"),
            new("POST",   "api/radius/ip-reservations/bulk-restore",  "radius.ip-reservations.delete"),
            new("POST",   "api/radius/ip-reservations/*/restore",     "radius.ip-reservations.delete"),
            new("GET",    "api/radius/ip-reservations/*",             "radius.ip-reservations.view"),
            new("PUT",    "api/radius/ip-reservations/*",             "radius.ip-reservations.update"),
            new("DELETE", "api/radius/ip-reservations/*",             "radius.ip-reservations.delete"),
            new("GET",    "api/radius/ip-reservations",               "radius.ip-reservations.view"),
            new("POST",   "api/radius/ip-reservations",               "radius.ip-reservations.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Custom Attributes
            // ═══════════════════════════════════════════════════════════
            new("DELETE", "api/radius/custom-attributes/bulk",        "radius.custom-attributes.delete"),
            new("POST",   "api/radius/custom-attributes/bulk-restore","radius.custom-attributes.delete"),
            new("POST",   "api/radius/custom-attributes/*/restore",   "radius.custom-attributes.delete"),
            new("GET",    "api/radius/custom-attributes/*",           "radius.custom-attributes.view"),
            new("PUT",    "api/radius/custom-attributes/*",           "radius.custom-attributes.update"),
            new("DELETE", "api/radius/custom-attributes/*",           "radius.custom-attributes.delete"),
            new("GET",    "api/radius/custom-attributes",             "radius.custom-attributes.view"),
            new("POST",   "api/radius/custom-attributes",             "radius.custom-attributes.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Zones
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/zone/flat",                            "radius.zones.view"),
            new("POST",   "api/zone/*/restore",                       "radius.zones.delete"),
            new("POST",   "api/zone/*/assign-users",                  "radius.zones.update"),
            new("GET",    "api/zone/*/users",                         "radius.zones.view"),
            new("POST",   "api/zone/*/radius-users",                  "radius.zones.update"),
            new("GET",    "api/zone/*/radius-users",                  "radius.zones.view"),
            new("GET",    "api/zone/*",                               "radius.zones.view"),
            new("PUT",    "api/zone/*",                               "radius.zones.update"),
            new("DELETE", "api/zone/*",                               "radius.zones.delete"),
            new("GET",    "api/zone",                                 "radius.zones.view"),
            new("POST",   "api/zone",                                 "radius.zones.create"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS — Activations
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/radiusactivation/trash",               "radius.activations.view"),
            new("POST",   "api/radiusactivation/*/restore",           "radius.activations.delete"),
            new("GET",    "api/radiusactivation/*/history",           "radius.activations.view"),
            new("GET",    "api/radiusactivation/*/sessions",          "radius.activations.view"),
            new("GET",    "api/radiusactivation/*/traffic",           "radius.activations.view"),
            new("GET",    "api/radiusactivation/*/status",            "radius.activations.view"),
            new("GET",    "api/radiusactivation/*",                   "radius.activations.view"),
            new("PUT",    "api/radiusactivation/*",                   "radius.activations.update"),
            new("DELETE", "api/radiusactivation/*",                   "radius.activations.delete"),
            new("GET",    "api/radiusactivation",                     "radius.activations.view"),
            new("POST",   "api/radiusactivation",                     "radius.activations.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Profiles
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/profiles/reorder",             "billing.profiles.update"),
            new("POST",   "api/billing/profiles/*/toggle-active",     "billing.profiles.update"),
            new("POST",   "api/billing/profiles/*/restore",           "billing.profiles.delete"),
            new("GET",    "api/billing/profiles/*",                   "billing.profiles.view"),
            new("PUT",    "api/billing/profiles/*",                   "billing.profiles.update"),
            new("DELETE", "api/billing/profiles/*",                   "billing.profiles.delete"),
            new("GET",    "api/billing/profiles",                     "billing.profiles.view"),
            new("POST",   "api/billing/profiles",                     "billing.profiles.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Activations
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/billing-activations/*/history",        "billing.activations.view"),
            new("GET",    "api/billing-activations/*/status",         "billing.activations.view"),
            new("GET",    "api/billing-activations/*",                "billing.activations.view"),
            new("GET",    "api/billing-activations",                  "billing.activations.view"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Addons
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/addons/*/restore",             "billing.addons.delete"),
            new("GET",    "api/billing/addons/*",                     "billing.addons.view"),
            new("PUT",    "api/billing/addons/*",                     "billing.addons.update"),
            new("DELETE", "api/billing/addons/*",                     "billing.addons.delete"),
            new("GET",    "api/billing/addons",                       "billing.addons.view"),
            new("POST",   "api/billing/addons",                       "billing.addons.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Groups
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/groups/*/restore",             "billing.groups.delete"),
            new("GET",    "api/billing/groups/*",                     "billing.groups.view"),
            new("PUT",    "api/billing/groups/*",                     "billing.groups.update"),
            new("DELETE", "api/billing/groups/*",                     "billing.groups.delete"),
            new("GET",    "api/billing/groups",                       "billing.groups.view"),
            new("POST",   "api/billing/groups",                       "billing.groups.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Cashback Groups
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/cashback-groups/*/restore",    "billing.cashback-groups.delete"),
            new("GET",    "api/billing/cashback-groups/*/amounts",    "billing.cashback-groups.view"),
            new("GET",    "api/billing/cashback-groups/*/profiles",   "billing.cashback-groups.view"),
            new("GET",    "api/billing/cashback-groups/*",            "billing.cashback-groups.view"),
            new("PUT",    "api/billing/cashback-groups/*",            "billing.cashback-groups.update"),
            new("DELETE", "api/billing/cashback-groups/*",            "billing.cashback-groups.delete"),
            new("GET",    "api/billing/cashback-groups",              "billing.cashback-groups.view"),
            new("POST",   "api/billing/cashback-groups",              "billing.cashback-groups.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Cashback Profile Amounts
            // ═══════════════════════════════════════════════════════════
            new("DELETE", "api/billing/cashback-profile-amounts/by-group/*", "billing.cashbacks.delete"),
            new("DELETE", "api/billing/cashback-profile-amounts/*",   "billing.cashbacks.delete"),
            new("GET",    "api/billing/cashback-profile-amounts",     "billing.cashbacks.view"),
            new("POST",   "api/billing/cashback-profile-amounts",     "billing.cashbacks.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Cashback Settings
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/billing/cashback-settings",            "billing.cashbacks.view"),
            new("POST",   "api/billing/cashback-settings",            "billing.cashbacks.update"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Custom Wallets
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/custom-wallets/reorder",       "billing.wallets.update"),
            new("GET",    "api/billing/custom-wallets/*/transactions","billing.wallets.view"),
            new("GET",    "api/billing/custom-wallets/*/balance",     "billing.wallets.view"),
            new("GET",    "api/billing/custom-wallets/*",             "billing.wallets.view"),
            new("PUT",    "api/billing/custom-wallets/*",             "billing.wallets.update"),
            new("DELETE", "api/billing/custom-wallets/*",             "billing.wallets.delete"),
            new("GET",    "api/billing/custom-wallets",               "billing.wallets.view"),
            new("POST",   "api/billing/custom-wallets",               "billing.wallets.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Sub-Agent Cashbacks
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/sub-agent-cashbacks/bulk",     "billing.sub-agent-cashbacks.create"),
            new("GET",    "api/billing/sub-agent-cashbacks/sub-agents","billing.sub-agent-cashbacks.view"),
            new("GET",    "api/billing/sub-agent-cashbacks/*",        "billing.sub-agent-cashbacks.view"),
            new("DELETE", "api/billing/sub-agent-cashbacks/*",        "billing.sub-agent-cashbacks.delete"),
            new("GET",    "api/billing/sub-agent-cashbacks",          "billing.sub-agent-cashbacks.view"),
            new("POST",   "api/billing/sub-agent-cashbacks",          "billing.sub-agent-cashbacks.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Top-Up
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/topup/custom-wallet",                  "billing.topup.create"),
            new("POST",   "api/topup/user-wallet",                    "billing.topup.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Transactions
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/transactions/bulk-delete",     "billing.transactions.delete"),
            new("POST",   "api/billing/transactions/bulk-restore",    "billing.transactions.delete"),
            new("POST",   "api/billing/transactions/*/restore",       "billing.transactions.delete"),
            new("GET",    "api/billing/transactions/*/attachments",   "billing.transactions.view"),
            new("POST",   "api/billing/transactions/*/comments",      "billing.transactions.create"),
            new("GET",    "api/billing/transactions/*/comments",      "billing.transactions.view"),
            new("GET",    "api/billing/transactions/*",               "billing.transactions.view"),
            new("DELETE", "api/billing/transactions/*",               "billing.transactions.delete"),
            new("GET",    "api/billing/transactions",                 "billing.transactions.view"),
            new("POST",   "api/billing/transactions",                 "billing.transactions.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — User Cashbacks
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/billing/user-cashbacks/all",           "billing.cashbacks.view"),
            new("GET",    "api/billing/user-cashbacks/calculate",     "billing.cashbacks.view"),
            new("DELETE", "api/billing/user-cashbacks/by-group/*",    "billing.cashbacks.delete"),
            new("DELETE", "api/billing/user-cashbacks/*",             "billing.cashbacks.delete"),
            new("GET",    "api/billing/user-cashbacks/*",             "billing.cashbacks.view"),
            new("GET",    "api/billing/user-cashbacks",               "billing.cashbacks.view"),
            new("POST",   "api/billing/user-cashbacks",               "billing.cashbacks.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — User Wallets
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/billing/user-wallets/*/history",       "billing.user-wallets.view"),
            new("GET",    "api/billing/user-wallets/*",               "billing.user-wallets.view"),
            new("PUT",    "api/billing/user-wallets/*",               "billing.user-wallets.update"),
            new("DELETE", "api/billing/user-wallets/*",               "billing.user-wallets.delete"),
            new("GET",    "api/billing/user-wallets",                 "billing.user-wallets.view"),
            new("POST",   "api/billing/user-wallets",                 "billing.user-wallets.create"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Wallet History
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/billing/wallet-history/*",             "billing.history.view"),
            new("GET",    "api/billing/wallet-history",               "billing.history.view"),

            // ═══════════════════════════════════════════════════════════
            //  BILLING — Automations
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/billing/automations/*/restore",        "billing.automations.delete"),
            new("GET",    "api/billing/automations/*",                "billing.automations.view"),
            new("PUT",    "api/billing/automations/*",                "billing.automations.update"),
            new("DELETE", "api/billing/automations/*",                "billing.automations.delete"),
            new("GET",    "api/billing/automations",                  "billing.automations.view"),
            new("POST",   "api/billing/automations",                  "billing.automations.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Dashboards
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/dashboards/*/items/*/layout",         "dashboard.update"),
            new("DELETE", "api/dashboards/*/items/*",                 "dashboard.delete"),
            new("POST",   "api/dashboards/*/items",                  "dashboard.create"),
            new("POST",   "api/dashboards/*/radius-data",            "dashboard.view"),
            new("GET",    "api/dashboards/*",                        "dashboard.view"),
            new("PUT",    "api/dashboards/*",                        "dashboard.update"),
            new("DELETE", "api/dashboards/*",                        "dashboard.delete"),
            new("GET",    "api/dashboards",                          "dashboard.view"),
            new("POST",   "api/dashboards",                          "dashboard.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Database Backups
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/database-backup/upload",               "settings.database-backup.create"),
            new("POST",   "api/database-backup/restore",              "settings.database-backup.update"),
            new("POST",   "api/database-backup/*/backup",             "settings.database-backup.create"),
            new("GET",    "api/database-backup/*/download",           "settings.database-backup.view"),
            new("DELETE", "api/database-backup/*",                    "settings.database-backup.delete"),
            new("GET",    "api/database-backup/*/backups",            "settings.database-backup.view"),
            new("GET",    "api/database-backup/*",                    "settings.database-backup.view"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Integration Webhooks
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/integration-webhooks/*/regenerate-token","settings.integrations.update"),
            new("GET",    "api/integration-webhooks/*/logs",          "settings.integrations.view"),
            new("GET",    "api/integration-webhooks/*",               "settings.integrations.view"),
            new("PUT",    "api/integration-webhooks/*",               "settings.integrations.update"),
            new("DELETE", "api/integration-webhooks/*",               "settings.integrations.delete"),
            new("GET",    "api/integration-webhooks",                 "settings.integrations.view"),
            new("POST",   "api/integration-webhooks",                 "settings.integrations.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — OIDC Settings
            // ═══════════════════════════════════════════════════════════
            // Note: GET /api/oidc-settings/active and /default are [AllowAnonymous] — not mapped here
            new("GET",    "api/oidc-settings/trash",                  "settings.oidc.view"),
            new("POST",   "api/oidc-settings/test",                   "settings.oidc.update"),
            new("POST",   "api/oidc-settings/*/restore",              "settings.oidc.update"),
            new("PUT",    "api/oidc-settings/*/set-default",          "settings.oidc.update"),
            new("PUT",    "api/oidc-settings/*/toggle-active",        "settings.oidc.update"),
            new("GET",    "api/oidc-settings/*",                      "settings.oidc.view"),
            new("PUT",    "api/oidc-settings/*",                      "settings.oidc.update"),
            new("DELETE", "api/oidc-settings/*",                      "settings.oidc.update"),
            new("GET",    "api/oidc-settings",                        "settings.oidc.view"),
            new("POST",   "api/oidc-settings",                        "settings.oidc.update"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Payment Methods
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/payment-methods/*",                    "settings.payment-methods.view"),
            new("PUT",    "api/payment-methods/*",                    "settings.payment-methods.update"),
            new("DELETE", "api/payment-methods/*",                    "settings.payment-methods.delete"),
            new("GET",    "api/payment-methods",                      "settings.payment-methods.view"),
            new("POST",   "api/payment-methods",                      "settings.payment-methods.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — System Update
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/system-update/pre-check",              "settings.system-update.view"),
            new("POST",   "api/system-update/update-all",             "settings.system-update.update"),
            new("POST",   "api/system-update/update-selected",        "settings.system-update.update"),
            new("POST",   "api/system-update/check",                  "settings.system-update.view"),
            new("GET",    "api/system-update/status",                 "settings.system-update.view"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — System Settings (Developer)
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/system-settings/swagger",              "settings.developer.view"),
            new("PUT",    "api/system-settings/swagger",              "settings.developer.update"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Server Monitoring (also has [RequirePermission] attributes)
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/server-monitoring/resources",          "server-monitoring.view"),
            new("GET",    "api/server-monitoring/docker/info",        "server-monitoring.view"),
            new("GET",    "api/server-monitoring/containers/*/stats", "server-monitoring.view"),
            new("GET",    "api/server-monitoring/containers/*/logs",  "server-monitoring.logs.view"),
            new("POST",   "api/server-monitoring/containers/*/start", "server-monitoring.containers.manage"),
            new("POST",   "api/server-monitoring/containers/*/stop",  "server-monitoring.containers.manage"),
            new("POST",   "api/server-monitoring/containers/*/restart","server-monitoring.containers.manage"),
            new("GET",    "api/server-monitoring/containers",         "server-monitoring.view"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Workspaces
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/workspaces/export",                    "workspace.view"),
            new("POST",   "api/workspaces/*/restore",                 "workspace.delete"),
            new("GET",    "api/workspaces/*/integrations",            "workspace.view"),
            new("POST",   "api/workspaces/*/integrations",            "workspace.update"),
            new("GET",    "api/workspaces/*",                         "workspace.view"),
            new("PUT",    "api/workspaces/*",                         "workspace.update"),
            new("DELETE", "api/workspaces/*",                         "workspace.delete"),
            new("GET",    "api/workspaces",                           "workspace.view"),
            new("POST",   "api/workspaces",                           "workspace.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Workspace Settings
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/workspaces/*/settings/general",        "workspace.settings.view"),
            new("PUT",    "api/workspaces/*/settings/general",        "workspace.settings.update"),
            new("GET",    "api/workspaces/*/settings/tag-sync-rules", "workspace.settings.view"),
            new("POST",   "api/workspaces/*/settings/tag-sync-rules", "workspace.settings.update"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Users (Application Users)
            // ═══════════════════════════════════════════════════════════
            // Note: GET /me and PUT /me are self-access — no permission needed beyond authentication
            new("POST",   "api/users/exit-impersonation",             null), // Self — authenticated only
            new("POST",   "api/users/*/impersonate",                  "users.impersonate"),
            new("POST",   "api/users/*/switch-workspace",             "workspace.switch"),
            new("GET",    "api/users/*",                              "users.view"),
            new("PUT",    "api/users/*",                              "users.update"),
            new("DELETE", "api/users/*",                              "users.delete"),
            new("GET",    "api/users",                                "users.view"),
            new("POST",   "api/users",                                "users.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — User Management (Keycloak + DB)
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/user-management/sync-keycloak",        "users.update"),
            new("POST",   "api/user-management/permissions/*/restore","permissions.delete"),
            new("POST",   "api/user-management/permissions",          "permissions.create"),
            new("PUT",    "api/user-management/permissions/*",        "permissions.update"),
            new("DELETE", "api/user-management/permissions/*",        "permissions.delete"),
            new("GET",    "api/user-management/permissions",          "permissions.view"),
            new("POST",   "api/user-management/groups/*/restore",     "groups.delete"),
            new("POST",   "api/user-management/groups",               "groups.create"),
            new("PUT",    "api/user-management/groups/*",             "groups.update"),
            new("DELETE", "api/user-management/groups/*",             "groups.delete"),
            new("GET",    "api/user-management/groups/*",             "groups.view"),
            new("GET",    "api/user-management/groups",               "groups.view"),
            new("POST",   "api/user-management/roles/*/restore",      "roles.delete"),
            new("POST",   "api/user-management/roles/*/permissions",  "roles.assign_permissions"),
            new("GET",    "api/user-management/roles/*/permissions",  "roles.view"),
            new("POST",   "api/user-management/roles",                "roles.create"),
            new("PUT",    "api/user-management/roles/*",              "roles.update"),
            new("DELETE", "api/user-management/roles/*",              "roles.delete"),
            new("GET",    "api/user-management/roles/*",              "roles.view"),
            new("GET",    "api/user-management/roles",                "roles.view"),
            new("POST",   "api/user-management/*/roles",              "users.assign_roles"),
            new("DELETE", "api/user-management/*/roles/*",            "users.assign_roles"),
            new("GET",    "api/user-management/*/roles",              "users.view"),
            new("POST",   "api/user-management/*/groups",             "users.assign_groups"),
            new("DELETE", "api/user-management/*/groups/*",           "users.assign_groups"),
            new("GET",    "api/user-management/*/groups",             "users.view"),
            new("POST",   "api/user-management/*/impersonate",        "users.impersonate"),
            new("GET",    "api/user-management/*",                    "users.view"),
            new("PUT",    "api/user-management/*",                    "users.update"),
            new("GET",    "api/user-management",                      "users.view"),
            new("POST",   "api/user-management",                      "users.create"),

            // ═══════════════════════════════════════════════════════════
            //  MANAGEMENT — Tenants
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/tenant/switch",                        "workspace.switch"),
            new("POST",   "api/tenant/set-default",                   "workspace.update"),
            new("GET",    "api/tenant/current",                       null), // Self — authenticated only
            new("GET",    "api/tenant/*",                             "workspace.view"),

            // ═══════════════════════════════════════════════════════════
            //  NETWORK — OLTs
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/network/olts/trash",                   "network.olts.view"),
            new("GET",    "api/network/olts/pon-ports",               "network.olts.view"),
            new("GET",    "api/network/olts/export/excel",            "network.olts.view"),
            new("POST",   "api/network/olts/*/restore",               "network.olts.delete"),
            new("GET",    "api/network/olts/*/pon-ports",             "network.olts.view"),
            new("POST",   "api/network/olts/*/pon-ports",             "network.olts.create"),
            new("PUT",    "api/network/olts/*/pon-ports/*",           "network.olts.update"),
            new("DELETE", "api/network/olts/*/pon-ports/*",           "network.olts.delete"),
            new("GET",    "api/network/olts/*/subscribers",           "network.olts.view"),
            new("GET",    "api/network/olts/*",                       "network.olts.view"),
            new("PUT",    "api/network/olts/*",                       "network.olts.update"),
            new("DELETE", "api/network/olts/*",                       "network.olts.delete"),
            new("GET",    "api/network/olts",                         "network.olts.view"),
            new("POST",   "api/network/olts",                         "network.olts.create"),

            // ═══════════════════════════════════════════════════════════
            //  NETWORK — OLT Devices
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/network/olt-devices/*",                "network.olts.view"),
            new("PUT",    "api/network/olt-devices/*",                "network.olts.update"),
            new("DELETE", "api/network/olt-devices/*",                "network.olts.delete"),
            new("GET",    "api/network/olt-devices",                  "network.olts.view"),
            new("POST",   "api/network/olt-devices",                  "network.olts.create"),

            // ═══════════════════════════════════════════════════════════
            //  NETWORK — FDTs
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/network/fdts/trash",                   "network.fdts.view"),
            new("GET",    "api/network/fdts/export/excel",            "network.fdts.view"),
            new("POST",   "api/network/fdts/*/restore",               "network.fdts.delete"),
            new("GET",    "api/network/fdts/*/subscribers",           "network.fdts.view"),
            new("GET",    "api/network/fdts/*",                       "network.fdts.view"),
            new("PUT",    "api/network/fdts/*",                       "network.fdts.update"),
            new("DELETE", "api/network/fdts/*",                       "network.fdts.delete"),
            new("GET",    "api/network/fdts",                         "network.fdts.view"),
            new("POST",   "api/network/fdts",                         "network.fdts.create"),

            // ═══════════════════════════════════════════════════════════
            //  NETWORK — FATs
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/network/fats/trash",                   "network.fats.view"),
            new("GET",    "api/network/fats/export/excel",            "network.fats.view"),
            new("POST",   "api/network/fats/*/restore",               "network.fats.delete"),
            new("GET",    "api/network/fats/*/subscribers",           "network.fats.view"),
            new("GET",    "api/network/fats/*",                       "network.fats.view"),
            new("PUT",    "api/network/fats/*",                       "network.fats.update"),
            new("DELETE", "api/network/fats/*",                       "network.fats.delete"),
            new("GET",    "api/network/fats",                         "network.fats.view"),
            new("POST",   "api/network/fats",                         "network.fats.create"),

            // ═══════════════════════════════════════════════════════════
            //  CONNECTORS — Debezium
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/debezium/settings",                    "connectors.settings.view"),
            new("PUT",    "api/debezium/settings",                    "connectors.settings.update"),
            new("POST",   "api/debezium/settings/test",               "connectors.settings.update"),
            new("POST",   "api/debezium/settings/test-connection",    "connectors.settings.update"),
            new("POST",   "api/debezium/settings/tables",             "connectors.settings.view"),
            new("POST",   "api/debezium/connectors/*/sync",           "connectors.list.manage"),
            new("PUT",    "api/debezium/connectors/*/pause",          "connectors.list.manage"),
            new("PUT",    "api/debezium/connectors/*/resume",         "connectors.list.manage"),
            new("POST",   "api/debezium/connectors/*/restart",        "connectors.list.manage"),
            new("GET",    "api/debezium/connectors/*",                "connectors.list.view"),
            new("PUT",    "api/debezium/connectors/*",                "connectors.list.update"),
            new("DELETE", "api/debezium/connectors/*",                "connectors.list.delete"),
            new("GET",    "api/debezium/connectors",                  "connectors.list.view"),
            new("POST",   "api/debezium/connectors",                  "connectors.list.create"),

            // ═══════════════════════════════════════════════════════════
            //  CONNECTORS — CDC Monitor
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/cdc/topics/*/messages",                "connectors.cdc-monitor.view"),
            new("GET",    "api/cdc/topics",                           "connectors.cdc-monitor.view"),

            // ═══════════════════════════════════════════════════════════
            //  PAYMENTS
            // ═══════════════════════════════════════════════════════════
            // Note: callback & webhook endpoints are [AllowAnonymous] — not mapped here
            new("POST",   "api/payments/initiate",                    "payments.create"),
            new("GET",    "api/payments/*/status",                    "payments.view"),
            new("GET",    "api/payments/wallet/balance",              "payments.view"),
            new("GET",    "api/payments/wallet/transactions",         "payments.view"),
            new("GET",    "api/payments/zaincashv2/inquiry/*",        "payments.view"),
            new("POST",   "api/payments/zaincashv2/reverse",          "payments.create"),
            new("GET",    "api/payments/*/inquiry",                    "payments.view"),
            new("POST",   "api/payments/*/force-complete",              "payments.force-complete"),

            // ═══════════════════════════════════════════════════════════
            //  SAS Activations
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/sasactivations/*/retry",               "settings.integrations.update"),
            new("POST",   "api/sasactivations/retry-failed",          "settings.integrations.update"),
            new("POST",   "api/sasactivations/test",                  "settings.integrations.update"),
            new("POST",   "api/sasactivations/batch",                 "settings.integrations.update"),
            new("GET",    "api/sasactivations/*/details",             "settings.integrations.view"),
            new("GET",    "api/sasactivations/stats",                 "settings.integrations.view"),
            new("GET",    "api/sasactivations/logs",                  "settings.integrations.view"),
            new("GET",    "api/sasactivations/queue-stats",           "settings.integrations.view"),
            new("GET",    "api/sasactivations/*",                     "settings.integrations.view"),

            // ═══════════════════════════════════════════════════════════
            //  JOBS
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/jobs/cleanup",                         "jobs.manage"),
            new("POST",   "api/jobs/*/report",                        "jobs.manage"),
            new("POST",   "api/jobs/*/recurring",                     "jobs.manage"),
            new("DELETE", "api/jobs/*/recurring",                     "jobs.manage"),
            new("POST",   "api/jobs/*/sync",                          "jobs.manage"),

            // ═══════════════════════════════════════════════════════════
            //  FREERADIUS LOGS
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/freeradiuslogs/fetch",                 "freeradius.logs.view"),
            new("GET",    "api/freeradiuslogs/statistics",            "freeradius.logs.view"),
            new("GET",    "api/freeradiuslogs/radwtmp",               "freeradius.logs.view"),
            new("GET",    "api/freeradiuslogs/*/status",              "freeradius.logs.view"),
            new("GET",    "api/freeradiuslogs/*/types",               "freeradius.logs.view"),

            // ═══════════════════════════════════════════════════════════
            //  SAS RADIUS INTEGRATIONS (workspace-scoped)
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/workspaces/*/sas-radius/trash",        "settings.integrations.view"),
            new("GET",    "api/workspaces/*/sas-radius/syncs/active", "settings.integrations.view"),
            new("GET",    "api/workspaces/*/sas-radius/export",       "settings.integrations.view"),
            new("POST",   "api/workspaces/*/sas-radius/import",       "settings.integrations.create"),
            new("POST",   "api/workspaces/*/sas-radius/*/restore",    "settings.integrations.delete"),
            new("POST",   "api/workspaces/*/sas-radius/*/sync",       "settings.integrations.update"),
            new("POST",   "api/workspaces/*/sas-radius/*/sync-managers","settings.integrations.update"),
            new("GET",    "api/workspaces/*/sas-radius/syncs/*/logs", "settings.integrations.view"),
            new("POST",   "api/workspaces/*/sas-radius/syncs/*/cancel","settings.integrations.update"),
            new("GET",    "api/workspaces/*/sas-radius/syncs/*",      "settings.integrations.view"),
            new("GET",    "api/workspaces/*/sas-radius/*",            "settings.integrations.view"),
            new("PUT",    "api/workspaces/*/sas-radius/*",            "settings.integrations.update"),
            new("DELETE", "api/workspaces/*/sas-radius/*",            "settings.integrations.delete"),
            new("GET",    "api/workspaces/*/sas-radius",              "settings.integrations.view"),
            new("POST",   "api/workspaces/*/sas-radius",              "settings.integrations.create"),

            // ═══════════════════════════════════════════════════════════
            //  SESSION SYNC
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/session-sync/*/sync",                  "settings.integrations.update"),
            new("POST",   "api/session-sync/*/cancel",                "settings.integrations.update"),
            new("GET",    "api/session-sync/*/logs",                  "settings.integrations.view"),
            new("GET",    "api/session-sync/*",                       "settings.integrations.view"),

            // ═══════════════════════════════════════════════════════════
            //  RADIUS USER INFO (traffic/sessions)
            // ═══════════════════════════════════════════════════════════
            new("POST",   "api/radius-user-info/traffic",             "radius.users.view"),
            new("POST",   "api/radius-user-info/sessions",            "radius.users.view"),

            // ═══════════════════════════════════════════════════════════
            //  WORKFLOW HISTORY
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/workflow-history/*",                    "billing.automations.view"),
            new("GET",    "api/workflow-history",                      "billing.automations.view"),
            new("DELETE", "api/workflow-history/*",                    "billing.automations.delete"),
            new("DELETE", "api/workflow-history/cleanup",              "billing.automations.delete"),

            // ═══════════════════════════════════════════════════════════
            //  API KEYS (management — Keycloak-authenticated)
            // ═══════════════════════════════════════════════════════════
            new("GET",    "api/api-keys/scopes",                      "settings.api-keys.view"),
            new("GET",    "api/api-keys/*",                           "settings.api-keys.view"),
            new("PUT",    "api/api-keys/*",                           "settings.api-keys.update"),
            new("DELETE", "api/api-keys/*",                           "settings.api-keys.delete"),
            new("GET",    "api/api-keys",                             "settings.api-keys.view"),
            new("POST",   "api/api-keys",                             "settings.api-keys.create"),
        };
    }
}

/// <summary>
/// Represents a single route → permission mapping entry.
/// </summary>
public record RoutePermissionEntry(string HttpMethod, string RoutePattern, string? Permission);
