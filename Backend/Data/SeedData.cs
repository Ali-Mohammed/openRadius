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

        // Seed Permissions
        if (!context.Permissions.Any())
        {
            SeedPermissions(context);
        }

        // Seed Roles
        if (!context.Roles.Any())
        {
            SeedRoles(context);
        }

        // Seed Groups
        if (!context.Groups.Any())
        {
            SeedGroups(context);
        }

        // Seed Role-Permission mappings
        if (!context.RolePermissions.Any())
        {
            SeedRolePermissions(context);
        }
    }

    private static void SeedPermissions(MasterDbContext context)
    {
        var permissions = new List<Permission>
        {
            // Integration Permissions
            new Permission { Name = "integration.sas_radius.view", Description = "View SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.create", Description = "Create SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.update", Description = "Update SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.delete", Description = "Delete SAS RADIUS integration", Category = "Integration" },
            new Permission { Name = "integration.sas_radius.sync", Description = "Sync SAS RADIUS integration", Category = "Integration" },

            // RADIUS Users Permissions
            new Permission { Name = "radius.users.view", Description = "View RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.create", Description = "Create RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.update", Description = "Update RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.delete", Description = "Delete RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.import", Description = "Import RADIUS users", Category = "RADIUS" },
            new Permission { Name = "radius.users.export", Description = "Export RADIUS users", Category = "RADIUS" },

            // RADIUS Profiles Permissions
            new Permission { Name = "radius.profiles.view", Description = "View RADIUS profiles", Category = "RADIUS" },
            new Permission { Name = "radius.profiles.create", Description = "Create RADIUS profiles", Category = "RADIUS" },
            new Permission { Name = "radius.profiles.update", Description = "Update RADIUS profiles", Category = "RADIUS" },
            new Permission { Name = "radius.profiles.delete", Description = "Delete RADIUS profiles", Category = "RADIUS" },

            // RADIUS Groups Permissions
            new Permission { Name = "radius.groups.view", Description = "View RADIUS groups", Category = "RADIUS" },
            new Permission { Name = "radius.groups.create", Description = "Create RADIUS groups", Category = "RADIUS" },
            new Permission { Name = "radius.groups.update", Description = "Update RADIUS groups", Category = "RADIUS" },
            new Permission { Name = "radius.groups.delete", Description = "Delete RADIUS groups", Category = "RADIUS" },

            // RADIUS Tags Permissions
            new Permission { Name = "radius.tags.view", Description = "View RADIUS tags", Category = "RADIUS" },
            new Permission { Name = "radius.tags.create", Description = "Create RADIUS tags", Category = "RADIUS" },
            new Permission { Name = "radius.tags.update", Description = "Update RADIUS tags", Category = "RADIUS" },
            new Permission { Name = "radius.tags.delete", Description = "Delete RADIUS tags", Category = "RADIUS" },

            // Workspace Permissions
            new Permission { Name = "workspace.view", Description = "View workspace details", Category = "Workspace" },
            new Permission { Name = "workspace.create", Description = "Create workspaces", Category = "Workspace" },
            new Permission { Name = "workspace.update", Description = "Update workspace settings", Category = "Workspace" },
            new Permission { Name = "workspace.delete", Description = "Delete workspaces", Category = "Workspace" },
            new Permission { Name = "workspace.switch", Description = "Switch between workspaces", Category = "Workspace" },
            new Permission { Name = "workspace.settings.view", Description = "View workspace settings", Category = "Workspace" },
            new Permission { Name = "workspace.settings.update", Description = "Update workspace settings", Category = "Workspace" },

            // App Settings Permissions
            new Permission { Name = "settings.general.view", Description = "View general settings", Category = "Settings" },
            new Permission { Name = "settings.general.update", Description = "Update general settings", Category = "Settings" },
            new Permission { Name = "settings.oidc.view", Description = "View OIDC settings", Category = "Settings" },
            new Permission { Name = "settings.oidc.update", Description = "Update OIDC settings", Category = "Settings" },

            // User Management Permissions
            new Permission { Name = "users.view", Description = "View users", Category = "UserManagement" },
            new Permission { Name = "users.create", Description = "Create users", Category = "UserManagement" },
            new Permission { Name = "users.update", Description = "Update users", Category = "UserManagement" },
            new Permission { Name = "users.delete", Description = "Delete users", Category = "UserManagement" },
            new Permission { Name = "users.assign_roles", Description = "Assign roles to users", Category = "UserManagement" },
            new Permission { Name = "users.assign_groups", Description = "Assign groups to users", Category = "UserManagement" },

            // Roles Management Permissions
            new Permission { Name = "roles.view", Description = "View roles", Category = "UserManagement" },
            new Permission { Name = "roles.create", Description = "Create roles", Category = "UserManagement" },
            new Permission { Name = "roles.update", Description = "Update roles", Category = "UserManagement" },
            new Permission { Name = "roles.delete", Description = "Delete roles", Category = "UserManagement" },
            new Permission { Name = "roles.assign_permissions", Description = "Assign permissions to roles", Category = "UserManagement" },

            // Permissions Management Permissions
            new Permission { Name = "permissions.view", Description = "View permissions", Category = "UserManagement" },
            new Permission { Name = "permissions.create", Description = "Create permissions", Category = "UserManagement" },
            new Permission { Name = "permissions.update", Description = "Update permissions", Category = "UserManagement" },
            new Permission { Name = "permissions.delete", Description = "Delete permissions", Category = "UserManagement" },

            // Groups Management Permissions
            new Permission { Name = "groups.view", Description = "View user groups", Category = "UserManagement" },
            new Permission { Name = "groups.create", Description = "Create user groups", Category = "UserManagement" },
            new Permission { Name = "groups.update", Description = "Update user groups", Category = "UserManagement" },
            new Permission { Name = "groups.delete", Description = "Delete user groups", Category = "UserManagement" },

            // Dashboard & Reports Permissions
            new Permission { Name = "dashboard.view", Description = "View dashboard", Category = "General" },
            new Permission { Name = "reports.view", Description = "View reports", Category = "General" },
            new Permission { Name = "reports.export", Description = "Export reports", Category = "General" },

            // Audit & Logs Permissions
            new Permission { Name = "audit.view", Description = "View audit logs", Category = "General" },
            new Permission { Name = "logs.view", Description = "View system logs", Category = "General" },
        };

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
}
