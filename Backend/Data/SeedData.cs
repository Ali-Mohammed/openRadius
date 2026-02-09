using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

/// <summary>
/// Provides seed data for Roles, Permissions, and Groups.
/// This seeds the master database with initial data based on the application structure.
/// </summary>
public static class SeedData
{
    public static void Initialize(MasterDbContext context)
    {
        // Ensure database is created
        context.Database.EnsureCreated();

        Console.WriteLine("=== Checking seed data status ===");
        
        var permissionsCount = context.Permissions.Count();
        var rolesCount = context.Roles.Count();
        var groupsCount = context.Groups.Count();
        var rolePermissionsCount = context.RolePermissions.Count();

        Console.WriteLine($"Current counts - Permissions: {permissionsCount}, Roles: {rolesCount}, Groups: {groupsCount}, RolePermissions: {rolePermissionsCount}");

        // Seed Permissions
        if (permissionsCount == 0)
        {
            Console.WriteLine("Seeding Permissions...");
            SeedPermissions(context);
            permissionsCount = context.Permissions.Count();
            Console.WriteLine($"✓ {permissionsCount} Permissions seeded");
        }
        else
        {
            Console.WriteLine($"⊘ Checking for new permissions to add (existing: {permissionsCount})...");
            var addedCount = UpsertNewPermissions(context);
            if (addedCount > 0)
            {
                Console.WriteLine($"✓ {addedCount} new permissions added");
                permissionsCount = context.Permissions.Count();
            }
            else
            {
                Console.WriteLine($"⊘ All permissions up to date ({permissionsCount})");
            }
        }

        // Seed Roles
        if (rolesCount == 0)
        {
            Console.WriteLine("Seeding Roles...");
            SeedRoles(context);
            rolesCount = context.Roles.Count();
            Console.WriteLine($"✓ {rolesCount} Roles seeded");
        }
        else
        {
            Console.WriteLine($"⊘ Skipping Roles (already exists: {rolesCount})");
        }

        // Seed Groups
        if (groupsCount == 0)
        {
            Console.WriteLine("Seeding Groups...");
            SeedGroups(context);
            groupsCount = context.Groups.Count();
            Console.WriteLine($"✓ {groupsCount} Groups seeded");
        }
        else
        {
            Console.WriteLine($"⊘ Skipping Groups (already exists: {groupsCount})");
        }

        // Seed Role-Permission mappings
        if (rolePermissionsCount == 0 && rolesCount > 0 && permissionsCount > 0)
        {
            Console.WriteLine("Seeding Role-Permission mappings...");
            SeedRolePermissions(context);
            rolePermissionsCount = context.RolePermissions.Count();
            Console.WriteLine($"✓ {rolePermissionsCount} Role-Permission mappings seeded");
        }
        else if (rolePermissionsCount > 0)
        {
            Console.WriteLine($"⊘ Skipping RolePermissions (already exists: {rolePermissionsCount})");
        }
        
        Console.WriteLine("=== Seed data check complete ===");
    }

    private static void SeedPermissions(MasterDbContext context)
    {
        var permissions = GetAllPermissionDefinitions();
        context.Permissions.AddRange(permissions);
        context.SaveChanges();
    }

    private static void SeedRoles(MasterDbContext context)
    {
        var roles = new List<Role>
        {
            new Role
            {
                Name = "Super Administrator",
                Description = "Full system access with all permissions. Can manage system settings, users, roles, and all RADIUS configurations."
            },
            new Role
            {
                Name = "Administrator",
                Description = "Workspace administrator with full access to RADIUS management and workspace settings. Cannot manage global system settings."
            },
            new Role
            {
                Name = "Workspace Manager",
                Description = "Can manage workspace settings and RADIUS configurations. Cannot manage users or system settings."
            },
            new Role
            {
                Name = "RADIUS Operator",
                Description = "Can create, update, and delete RADIUS users, profiles, groups, and tags. Limited workspace access."
            },
            new Role
            {
                Name = "RADIUS Viewer",
                Description = "Read-only access to RADIUS configurations. Can view users, profiles, groups, and tags but cannot modify them."
            },
            new Role
            {
                Name = "Integration Manager",
                Description = "Can manage SAS RADIUS integration and sync operations. Limited access to other features."
            },
            new Role
            {
                Name = "User Manager",
                Description = "Can manage users, assign roles and groups. Cannot manage roles, permissions, or system settings."
            },
            new Role
            {
                Name = "Auditor",
                Description = "Read-only access to all data including audit logs and reports. Cannot modify any data."
            },
            new Role
            {
                Name = "Viewer",
                Description = "Basic read-only access to dashboard and assigned workspace data."
            }
        };

        context.Roles.AddRange(roles);
        context.SaveChanges();
    }

    private static void SeedGroups(MasterDbContext context)
    {
        var groups = new List<Group>
        {
            new Group
            {
                Name = "IT Department",
                Description = "Information Technology department members"
            },
            new Group
            {
                Name = "Network Operations",
                Description = "Network operations and infrastructure team"
            },
            new Group
            {
                Name = "Security Team",
                Description = "Information security and compliance team"
            },
            new Group
            {
                Name = "Support Team",
                Description = "Customer and technical support team"
            },
            new Group
            {
                Name = "Management",
                Description = "Executive and management team members"
            },
            new Group
            {
                Name = "Development Team",
                Description = "Software development and engineering team"
            },
            new Group
            {
                Name = "Integration Specialists",
                Description = "Team responsible for third-party integrations"
            },
            new Group
            {
                Name = "Compliance Officers",
                Description = "Regulatory compliance and audit personnel"
            }
        };

        context.Groups.AddRange(groups);
        context.SaveChanges();
    }

    private static void SeedRolePermissions(MasterDbContext context)
    {
        // Reload data from database to ensure we have the saved entities
        var roles = context.Roles.AsNoTracking().ToList();
        var permissions = context.Permissions.AsNoTracking().ToList();

        if (!roles.Any() || !permissions.Any())
        {
            Console.WriteLine("⚠ Roles or Permissions not found. Skipping RolePermissions seeding.");
            return;
        }

        var rolePermissions = new List<RolePermission>();

        // Super Administrator - All permissions
        var superAdmin = roles.FirstOrDefault(r => r.Name == "Super Administrator");
        if (superAdmin == null)
        {
            Console.WriteLine("⚠ Super Administrator role not found.");
            return;
        }
        foreach (var permission in permissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = superAdmin.Id,
                PermissionId = permission.Id
            });
        }

        // Administrator - All except system settings
        var admin = roles.FirstOrDefault(r => r.Name == "Administrator");
        if (admin == null) return;
        var adminPermissions = permissions.Where(p =>
            !p.Name.StartsWith("settings.oidc") &&
            !p.Name.Contains("permissions.") &&
            p.Name != "users.delete"
        );
        foreach (var permission in adminPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = admin.Id,
                PermissionId = permission.Id
            });
        }

        // Workspace Manager
        var workspaceManager = roles.FirstOrDefault(r => r.Name == "Workspace Manager");
        if (workspaceManager == null) return;
        var workspacePermissions = permissions.Where(p =>
            p.Name.StartsWith("workspace.") ||
            p.Name.StartsWith("radius.") ||
            p.Name.StartsWith("integration.") ||
            p.Name == "dashboard.view" ||
            p.Name == "reports.view"
        );
        foreach (var permission in workspacePermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = workspaceManager.Id,
                PermissionId = permission.Id
            });
        }

        // RADIUS Operator
        var radiusOperator = roles.FirstOrDefault(r => r.Name == "RADIUS Operator");
        if (radiusOperator == null) return;
        var radiusOperatorPermissions = permissions.Where(p =>
            p.Name.StartsWith("radius.") ||
            p.Name == "workspace.view" ||
            p.Name == "workspace.switch" ||
            p.Name == "dashboard.view"
        );
        foreach (var permission in radiusOperatorPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = radiusOperator.Id,
                PermissionId = permission.Id
            });
        }

        // RADIUS Viewer
        var radiusViewer = roles.FirstOrDefault(r => r.Name == "RADIUS Viewer");
        if (radiusViewer == null) return;
        var radiusViewerPermissions = permissions.Where(p =>
            p.Name.EndsWith(".view") &&
            (p.Name.StartsWith("radius.") || p.Name == "workspace.view" || p.Name == "dashboard.view")
        );
        foreach (var permission in radiusViewerPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = radiusViewer.Id,
                PermissionId = permission.Id
            });
        }

        // Integration Manager
        var integrationManager = roles.FirstOrDefault(r => r.Name == "Integration Manager");
        if (integrationManager == null) return;
        var integrationPermissions = permissions.Where(p =>
            p.Name.StartsWith("integration.") ||
            p.Name == "radius.users.view" ||
            p.Name == "radius.profiles.view" ||
            p.Name == "radius.groups.view" ||
            p.Name == "workspace.view" ||
            p.Name == "dashboard.view"
        );
        foreach (var permission in integrationPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = integrationManager.Id,
                PermissionId = permission.Id
            });
        }

        // User Manager
        var userManager = roles.FirstOrDefault(r => r.Name == "User Manager");
        if (userManager == null) return;
        var userManagerPermissions = permissions.Where(p =>
            p.Name.StartsWith("users.") ||
            p.Name == "groups.view" ||
            p.Name == "roles.view" ||
            p.Name == "dashboard.view"
        );
        foreach (var permission in userManagerPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = userManager.Id,
                PermissionId = permission.Id
            });
        }

        // Auditor
        var auditor = roles.FirstOrDefault(r => r.Name == "Auditor");
        if (auditor == null) return;
        var auditorPermissions = permissions.Where(p =>
            p.Name.EndsWith(".view") ||
            p.Name == "audit.view" ||
            p.Name == "logs.view" ||
            p.Name == "reports.export"
        );
        foreach (var permission in auditorPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = auditor.Id,
                PermissionId = permission.Id
            });
        }

        // Viewer
        var viewer = roles.FirstOrDefault(r => r.Name == "Viewer");
        if (viewer == null) return;
        var viewerPermissions = permissions.Where(p =>
            p.Name == "dashboard.view" ||
            p.Name == "workspace.view"
        );
        foreach (var permission in viewerPermissions)
        {
            rolePermissions.Add(new RolePermission
            {
                RoleId = viewer.Id,
                PermissionId = permission.Id
            });
        }

        context.RolePermissions.AddRange(rolePermissions);
        context.SaveChanges();
    }

    /// <summary>
    /// Adds any new permissions that don't already exist in the database.
    /// This ensures existing installations get new permissions when the application is updated.
    /// </summary>
    private static int UpsertNewPermissions(MasterDbContext context)
    {
        // Get all permission definitions (same list as SeedPermissions)
        var allDefinedPermissions = GetAllPermissionDefinitions();
        var existingNames = context.Permissions.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var newPermissions = allDefinedPermissions
            .Where(p => !existingNames.Contains(p.Name))
            .ToList();

        if (newPermissions.Count == 0)
            return 0;

        context.Permissions.AddRange(newPermissions);
        context.SaveChanges();

        // Also assign new permissions to Super Administrator role if it exists
        var superAdmin = context.Roles.FirstOrDefault(r => r.Name == "Super Administrator");
        if (superAdmin != null)
        {
            var existingRolePermissionIds = context.RolePermissions
                .Where(rp => rp.RoleId == superAdmin.Id)
                .Select(rp => rp.PermissionId)
                .ToHashSet();

            var newRolePermissions = newPermissions
                .Where(p => !existingRolePermissionIds.Contains(p.Id))
                .Select(p => new RolePermission
                {
                    RoleId = superAdmin.Id,
                    PermissionId = p.Id
                })
                .ToList();

            if (newRolePermissions.Count > 0)
            {
                context.RolePermissions.AddRange(newRolePermissions);
                context.SaveChanges();
                Console.WriteLine($"  → Assigned {newRolePermissions.Count} new permissions to Super Administrator");
            }
        }

        return newPermissions.Count;
    }

    /// <summary>
    /// Returns all permission definitions. Shared between SeedPermissions and UpsertNewPermissions.
    /// </summary>
    private static List<Permission> GetAllPermissionDefinitions()
    {
        return new List<Permission>
        {
            // Integration Permissions
            new Permission { Name = "integration.sas_radius.view", Description = "View SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.create", Description = "Create SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.update", Description = "Update SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.delete", Description = "Delete SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.sync", Description = "Sync SAS RADIUS integration", Category = "Integration" },
            // RADIUS Users
            new Permission { Name = "radius.users.view", Description = "View RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.create", Description = "Create RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.update", Description = "Update RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.delete", Description = "Delete RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.import", Description = "Import RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.export", Description = "Export RADIUS users", Category = "RADIUS" },
            // RADIUS Profiles
            new Permission { Name = "radius.profiles.view", Description = "View RADIUS profiles", Category = "RADIUS" },
            new Permission { Name = "radius.profiles.create", Description = "Create RADIUS profiles", Category = "RADIUS" },
            new Permission { Name = "radius.profiles.update", Description = "Update RADIUS profiles", Category = "RADIUS" },
            new Permission { Name = "radius.profiles.delete", Description = "Delete RADIUS profiles", Category = "RADIUS" },
            // RADIUS Groups
            new Permission { Name = "radius.groups.view", Description = "View RADIUS groups", Category = "RADIUS" },
            new Permission { Name = "radius.groups.create", Description = "Create RADIUS groups", Category = "RADIUS" },
            new Permission { Name = "radius.groups.update", Description = "Update RADIUS groups", Category = "RADIUS" },
            new Permission { Name = "radius.groups.delete", Description = "Delete RADIUS groups", Category = "RADIUS" },
            // RADIUS Tags
            new Permission { Name = "radius.tags.view", Description = "View RADIUS tags", Category = "RADIUS" },
            new Permission { Name = "radius.tags.create", Description = "Create RADIUS tags", Category = "RADIUS" },
            new Permission { Name = "radius.tags.update", Description = "Update RADIUS tags", Category = "RADIUS" },
            new Permission { Name = "radius.tags.delete", Description = "Delete RADIUS tags", Category = "RADIUS" },
            // RADIUS NAS
            new Permission { Name = "radius.nas.view", Description = "View RADIUS NAS devices", Category = "RADIUS" },
            new Permission { Name = "radius.nas.create", Description = "Create RADIUS NAS devices", Category = "RADIUS" },
            new Permission { Name = "radius.nas.update", Description = "Update RADIUS NAS devices", Category = "RADIUS" },
            new Permission { Name = "radius.nas.delete", Description = "Delete RADIUS NAS devices", Category = "RADIUS" },
            // RADIUS IP Pools
            new Permission { Name = "radius.ip-pools.view", Description = "View RADIUS IP pools", Category = "RADIUS" },
            new Permission { Name = "radius.ip-pools.create", Description = "Create RADIUS IP pools", Category = "RADIUS" },
            new Permission { Name = "radius.ip-pools.update", Description = "Update RADIUS IP pools", Category = "RADIUS" },
            new Permission { Name = "radius.ip-pools.delete", Description = "Delete RADIUS IP pools", Category = "RADIUS" },
            // RADIUS IP Reservations
            new Permission { Name = "radius.ip-reservations.view", Description = "View RADIUS IP reservations", Category = "RADIUS" },
            new Permission { Name = "radius.ip-reservations.create", Description = "Create RADIUS IP reservations", Category = "RADIUS" },
            new Permission { Name = "radius.ip-reservations.update", Description = "Update RADIUS IP reservations", Category = "RADIUS" },
            new Permission { Name = "radius.ip-reservations.delete", Description = "Delete RADIUS IP reservations", Category = "RADIUS" },
            // RADIUS Custom Attributes
            new Permission { Name = "radius.custom-attributes.view", Description = "View RADIUS custom attributes", Category = "RADIUS" },
            new Permission { Name = "radius.custom-attributes.create", Description = "Create RADIUS custom attributes", Category = "RADIUS" },
            new Permission { Name = "radius.custom-attributes.update", Description = "Update RADIUS custom attributes", Category = "RADIUS" },
            new Permission { Name = "radius.custom-attributes.delete", Description = "Delete RADIUS custom attributes", Category = "RADIUS" },
            // RADIUS Zones
            new Permission { Name = "radius.zones.view", Description = "View RADIUS zones", Category = "RADIUS" },
            new Permission { Name = "radius.zones.create", Description = "Create RADIUS zones", Category = "RADIUS" },
            new Permission { Name = "radius.zones.update", Description = "Update RADIUS zones", Category = "RADIUS" },
            new Permission { Name = "radius.zones.delete", Description = "Delete RADIUS zones", Category = "RADIUS" },
            // RADIUS Activations
            new Permission { Name = "radius.activations.view", Description = "View RADIUS activations", Category = "RADIUS" },
            new Permission { Name = "radius.activations.create", Description = "Create RADIUS activations", Category = "RADIUS" },
            new Permission { Name = "radius.activations.update", Description = "Update RADIUS activations", Category = "RADIUS" },
            new Permission { Name = "radius.activations.delete", Description = "Delete RADIUS activations", Category = "RADIUS" },
            // Workspace
            new Permission { Name = "workspace.view", Description = "View workspace details", Category = "Workspace" },
            new Permission { Name = "workspace.create", Description = "Create workspaces", Category = "Workspace" },
            new Permission { Name = "workspace.update", Description = "Update workspace settings", Category = "Workspace" },
            new Permission { Name = "workspace.delete", Description = "Delete workspaces", Category = "Workspace" },
            new Permission { Name = "workspace.switch", Description = "Switch between workspaces", Category = "Workspace" },
            new Permission { Name = "workspace.settings.view", Description = "View workspace settings", Category = "Workspace" },
            new Permission { Name = "workspace.settings.update", Description = "Update workspace settings", Category = "Workspace" },
            // Server Monitoring
            new Permission { Name = "server-monitoring.view", Description = "View server resources and Docker containers", Category = "Workspace" },
            new Permission { Name = "server-monitoring.containers.manage", Description = "Start, stop, and restart Docker containers", Category = "Workspace" },
            new Permission { Name = "server-monitoring.logs.view", Description = "View Docker container logs", Category = "Workspace" },
            // App Settings
            new Permission { Name = "settings.general.view", Description = "View general settings", Category = "Settings" },
            new Permission { Name = "settings.general.update", Description = "Update general settings", Category = "Settings" },
            new Permission { Name = "settings.oidc.view", Description = "View OIDC settings", Category = "Settings" },
            new Permission { Name = "settings.oidc.update", Description = "Update OIDC settings", Category = "Settings" },
            new Permission { Name = "settings.payment-history.view", Description = "View payment history", Category = "Settings" },
            new Permission { Name = "settings.database-backup.view", Description = "View database backup settings", Category = "Settings" },
            new Permission { Name = "settings.database-backup.create", Description = "Create database backups", Category = "Settings" },
            new Permission { Name = "settings.database-backup.update", Description = "Update database backup settings", Category = "Settings" },
            new Permission { Name = "settings.database-backup.delete", Description = "Delete database backups", Category = "Settings" },
            new Permission { Name = "settings.integrations.view", Description = "View integrations settings", Category = "Settings" },
            new Permission { Name = "settings.integrations.create", Description = "Create integrations", Category = "Settings" },
            new Permission { Name = "settings.integrations.update", Description = "Update integrations", Category = "Settings" },
            new Permission { Name = "settings.integrations.delete", Description = "Delete integrations", Category = "Settings" },
            // System Update
            new Permission { Name = "settings.system-update.view", Description = "View system update status", Category = "Settings" },
            new Permission { Name = "settings.system-update.update", Description = "Apply system updates", Category = "Settings" },
            // User Management
            new Permission { Name = "users.view", Description = "View users", Category = "UserManagement" },
            new Permission { Name = "users.create", Description = "Create users", Category = "UserManagement" },
            new Permission { Name = "users.update", Description = "Update users", Category = "UserManagement" },
            new Permission { Name = "users.delete", Description = "Delete users", Category = "UserManagement" },
            new Permission { Name = "users.assign_roles", Description = "Assign roles to users", Category = "UserManagement" },
            new Permission { Name = "users.assign_groups", Description = "Assign groups to users", Category = "UserManagement" },
            new Permission { Name = "users.impersonate", Description = "Impersonate other users", Category = "UserManagement" },
            // Roles Management
            new Permission { Name = "roles.view", Description = "View roles", Category = "UserManagement" },
            new Permission { Name = "roles.create", Description = "Create roles", Category = "UserManagement" },
            new Permission { Name = "roles.update", Description = "Update roles", Category = "UserManagement" },
            new Permission { Name = "roles.delete", Description = "Delete roles", Category = "UserManagement" },
            new Permission { Name = "roles.assign_permissions", Description = "Assign permissions to roles", Category = "UserManagement" },
            // Permissions Management
            new Permission { Name = "permissions.view", Description = "View permissions", Category = "UserManagement" },
            new Permission { Name = "permissions.create", Description = "Create permissions", Category = "UserManagement" },
            new Permission { Name = "permissions.update", Description = "Update permissions", Category = "UserManagement" },
            new Permission { Name = "permissions.delete", Description = "Delete permissions", Category = "UserManagement" },
            // Groups Management
            new Permission { Name = "groups.view", Description = "View user groups", Category = "UserManagement" },
            new Permission { Name = "groups.create", Description = "Create user groups", Category = "UserManagement" },
            new Permission { Name = "groups.update", Description = "Update user groups", Category = "UserManagement" },
            new Permission { Name = "groups.delete", Description = "Delete user groups", Category = "UserManagement" },
            // Dashboard & Reports
            new Permission { Name = "dashboard.view", Description = "View dashboard", Category = "General" },
            new Permission { Name = "dashboard.create", Description = "Create dashboard widgets", Category = "General" },
            new Permission { Name = "dashboard.update", Description = "Update dashboard widgets", Category = "General" },
            new Permission { Name = "dashboard.delete", Description = "Delete dashboard widgets", Category = "General" },
            new Permission { Name = "reports.view", Description = "View reports", Category = "General" },
            new Permission { Name = "reports.export", Description = "Export reports", Category = "General" },
            new Permission { Name = "reports.create", Description = "Create reports", Category = "General" },
            // Audit & Logs
            new Permission { Name = "audit.view", Description = "View audit logs", Category = "General" },
            new Permission { Name = "logs.view", Description = "View system logs", Category = "General" },
            // Billing
            new Permission { Name = "billing.profiles.view", Description = "View billing profiles", Category = "Billing" },
            new Permission { Name = "billing.profiles.create", Description = "Create billing profiles", Category = "Billing" },
            new Permission { Name = "billing.profiles.update", Description = "Update billing profiles", Category = "Billing" },
            new Permission { Name = "billing.profiles.delete", Description = "Delete billing profiles", Category = "Billing" },
            new Permission { Name = "billing.activations.view", Description = "View billing activations", Category = "Billing" },
            new Permission { Name = "billing.activations.create", Description = "Create billing activations", Category = "Billing" },
            // Payment Methods
            new Permission { Name = "settings.payment-methods.view", Description = "View payment methods", Category = "Settings" },
            new Permission { Name = "settings.payment-methods.create", Description = "Create payment methods", Category = "Settings" },
            new Permission { Name = "settings.payment-methods.update", Description = "Update payment methods", Category = "Settings" },
            new Permission { Name = "settings.payment-methods.delete", Description = "Delete payment methods", Category = "Settings" },
            // Payments
            new Permission { Name = "payments.view", Description = "View payment status and history", Category = "Billing" },
            new Permission { Name = "payments.create", Description = "Initiate payments", Category = "Billing" },
            new Permission { Name = "payments.force-complete", Description = "Force complete stuck/failed payments with audit trail", Category = "Billing" },
            // Jobs
            new Permission { Name = "jobs.view", Description = "View background jobs", Category = "Settings" },
            new Permission { Name = "jobs.manage", Description = "Manage background jobs", Category = "Settings" },
            // FreeRadius Logs
            new Permission { Name = "freeradius.logs.view", Description = "View FreeRADIUS logs", Category = "General" },
            // Billing Addons
            new Permission { Name = "billing.addons.view", Description = "View billing addons", Category = "Billing" },
            new Permission { Name = "billing.addons.create", Description = "Create billing addons", Category = "Billing" },
            new Permission { Name = "billing.addons.update", Description = "Update billing addons", Category = "Billing" },
            new Permission { Name = "billing.addons.delete", Description = "Delete billing addons", Category = "Billing" },
            // Billing Groups
            new Permission { Name = "billing.groups.view", Description = "View billing groups", Category = "Billing" },
            new Permission { Name = "billing.groups.create", Description = "Create billing groups", Category = "Billing" },
            new Permission { Name = "billing.groups.update", Description = "Update billing groups", Category = "Billing" },
            new Permission { Name = "billing.groups.delete", Description = "Delete billing groups", Category = "Billing" },
            // Billing Cashbacks
            new Permission { Name = "billing.cashbacks.view", Description = "View cashbacks", Category = "Billing" },
            new Permission { Name = "billing.cashbacks.create", Description = "Create cashbacks", Category = "Billing" },
            new Permission { Name = "billing.cashbacks.update", Description = "Update cashbacks", Category = "Billing" },
            new Permission { Name = "billing.cashbacks.delete", Description = "Delete cashbacks", Category = "Billing" },
            // Billing Cashback Groups
            new Permission { Name = "billing.cashback-groups.view", Description = "View cashback groups", Category = "Billing" },
            new Permission { Name = "billing.cashback-groups.create", Description = "Create cashback groups", Category = "Billing" },
            new Permission { Name = "billing.cashback-groups.update", Description = "Update cashback groups", Category = "Billing" },
            new Permission { Name = "billing.cashback-groups.delete", Description = "Delete cashback groups", Category = "Billing" },
            // Billing Sub-Agent Cashbacks
            new Permission { Name = "billing.sub-agent-cashbacks.view", Description = "View sub-agent cashbacks", Category = "Billing" },
            new Permission { Name = "billing.sub-agent-cashbacks.create", Description = "Create sub-agent cashbacks", Category = "Billing" },
            new Permission { Name = "billing.sub-agent-cashbacks.update", Description = "Update sub-agent cashbacks", Category = "Billing" },
            new Permission { Name = "billing.sub-agent-cashbacks.delete", Description = "Delete sub-agent cashbacks", Category = "Billing" },
            // Billing Wallets
            new Permission { Name = "billing.wallets.view", Description = "View custom wallets", Category = "Billing" },
            new Permission { Name = "billing.wallets.create", Description = "Create custom wallets", Category = "Billing" },
            new Permission { Name = "billing.wallets.update", Description = "Update custom wallets", Category = "Billing" },
            new Permission { Name = "billing.wallets.delete", Description = "Delete custom wallets", Category = "Billing" },
            // Billing User Wallets
            new Permission { Name = "billing.user-wallets.view", Description = "View user wallets", Category = "Billing" },
            new Permission { Name = "billing.user-wallets.create", Description = "Create user wallets", Category = "Billing" },
            new Permission { Name = "billing.user-wallets.update", Description = "Update user wallets", Category = "Billing" },
            new Permission { Name = "billing.user-wallets.delete", Description = "Delete user wallets", Category = "Billing" },
            // Billing Top-Up
            new Permission { Name = "billing.topup.view", Description = "View top-up", Category = "Billing" },
            new Permission { Name = "billing.topup.create", Description = "Create top-up", Category = "Billing" },
            // Billing History
            new Permission { Name = "billing.history.view", Description = "View wallet history", Category = "Billing" },
            // Billing Transactions
            new Permission { Name = "billing.transactions.view", Description = "View transactions", Category = "Billing" },
            new Permission { Name = "billing.transactions.create", Description = "Create transactions", Category = "Billing" },
            new Permission { Name = "billing.transactions.delete", Description = "Delete transactions", Category = "Billing" },
            // Billing Balances
            new Permission { Name = "billing.balances.view", Description = "View balances", Category = "Billing" },
            // Billing Automations
            new Permission { Name = "billing.automations.view", Description = "View billing automations", Category = "Billing" },
            new Permission { Name = "billing.automations.create", Description = "Create billing automations", Category = "Billing" },
            new Permission { Name = "billing.automations.update", Description = "Update billing automations", Category = "Billing" },
            new Permission { Name = "billing.automations.delete", Description = "Delete billing automations", Category = "Billing" },
            // Network - OLTs
            new Permission { Name = "network.olts.view", Description = "View OLT devices", Category = "Network" },
            new Permission { Name = "network.olts.create", Description = "Create OLT devices", Category = "Network" },
            new Permission { Name = "network.olts.update", Description = "Update OLT devices", Category = "Network" },
            new Permission { Name = "network.olts.delete", Description = "Delete OLT devices", Category = "Network" },
            // Network - FDTs
            new Permission { Name = "network.fdts.view", Description = "View FDT devices", Category = "Network" },
            new Permission { Name = "network.fdts.create", Description = "Create FDT devices", Category = "Network" },
            new Permission { Name = "network.fdts.update", Description = "Update FDT devices", Category = "Network" },
            new Permission { Name = "network.fdts.delete", Description = "Delete FDT devices", Category = "Network" },
            // Network - FATs
            new Permission { Name = "network.fats.view", Description = "View FAT devices", Category = "Network" },
            new Permission { Name = "network.fats.create", Description = "Create FAT devices", Category = "Network" },
            new Permission { Name = "network.fats.update", Description = "Update FAT devices", Category = "Network" },
            new Permission { Name = "network.fats.delete", Description = "Delete FAT devices", Category = "Network" },
            // Network - Other
            new Permission { Name = "network.provisioning.view", Description = "View network provisioning", Category = "Network" },
            new Permission { Name = "network.monitoring.view", Description = "View network monitoring", Category = "Network" },
            new Permission { Name = "network.reports.view", Description = "View network reports", Category = "Network" },
            new Permission { Name = "network.settings.view", Description = "View network settings", Category = "Network" },
            new Permission { Name = "network.settings.update", Description = "Update network settings", Category = "Network" },
            // Connectors
            new Permission { Name = "connectors.list.view", Description = "View CDC connectors", Category = "Connectors" },
            new Permission { Name = "connectors.list.create", Description = "Create CDC connectors", Category = "Connectors" },
            new Permission { Name = "connectors.list.update", Description = "Update CDC connectors", Category = "Connectors" },
            new Permission { Name = "connectors.list.delete", Description = "Delete CDC connectors", Category = "Connectors" },
            new Permission { Name = "connectors.list.manage", Description = "Manage CDC connectors (pause/resume/restart)", Category = "Connectors" },
            new Permission { Name = "connectors.cdc-monitor.view", Description = "View CDC monitor", Category = "Connectors" },
            new Permission { Name = "connectors.settings.view", Description = "View connector settings", Category = "Connectors" },
            new Permission { Name = "connectors.settings.update", Description = "Update connector settings", Category = "Connectors" },
            // Microservices
            new Permission { Name = "microservices.radius-sync.view", Description = "View RADIUS sync service", Category = "Microservices" },
            new Permission { Name = "microservices.radius-sync.manage", Description = "Manage RADIUS sync service", Category = "Microservices" },
        };
    }
}
