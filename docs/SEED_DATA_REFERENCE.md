# Seed Data Reference

This document describes the default roles, permissions, and groups that are automatically seeded into the OpenRadius application.

## Overview

The seed data is automatically loaded when the application starts if the database is empty. The seeding process creates:
- **73 Permissions** across 5 categories
- **9 Roles** with predefined permission sets
- **8 Groups** for organizing users

## Permissions

Permissions are organized into categories based on application modules:

### Integration (5 permissions)
- `integration.sas_radius.view` - View SAS RADIUS integration
- `integration.sas_radius.create` - Create SAS RADIUS integration
- `integration.sas_radius.update` - Update SAS RADIUS integration
- `integration.sas_radius.delete` - Delete SAS RADIUS integration
- `integration.sas_radius.sync` - Sync SAS RADIUS integration

### RADIUS (24 permissions)

#### RADIUS Users (6 permissions)
- `radius.users.view` - View RADIUS users
- `radius.users.create` - Create RADIUS users
- `radius.users.update` - Update RADIUS users
- `radius.users.delete` - Delete RADIUS users
- `radius.users.import` - Import RADIUS users
- `radius.users.export` - Export RADIUS users

#### RADIUS Profiles (4 permissions)
- `radius.profiles.view` - View RADIUS profiles
- `radius.profiles.create` - Create RADIUS profiles
- `radius.profiles.update` - Update RADIUS profiles
- `radius.profiles.delete` - Delete RADIUS profiles

#### RADIUS Groups (4 permissions)
- `radius.groups.view` - View RADIUS groups
- `radius.groups.create` - Create RADIUS groups
- `radius.groups.update` - Update RADIUS groups
- `radius.groups.delete` - Delete RADIUS groups

#### RADIUS Tags (4 permissions)
- `radius.tags.view` - View RADIUS tags
- `radius.tags.create` - Create RADIUS tags
- `radius.tags.update` - Update RADIUS tags
- `radius.tags.delete` - Delete RADIUS tags

### Workspace (7 permissions)
- `workspace.view` - View workspace details
- `workspace.create` - Create workspaces
- `workspace.update` - Update workspace settings
- `workspace.delete` - Delete workspaces
- `workspace.switch` - Switch between workspaces
- `workspace.settings.view` - View workspace settings
- `workspace.settings.update` - Update workspace settings

### Settings (4 permissions)
- `settings.general.view` - View general settings
- `settings.general.update` - Update general settings
- `settings.oidc.view` - View OIDC settings
- `settings.oidc.update` - Update OIDC settings

### User Management (20 permissions)

#### Users (6 permissions)
- `users.view` - View users
- `users.create` - Create users
- `users.update` - Update users
- `users.delete` - Delete users
- `users.assign_roles` - Assign roles to users
- `users.assign_groups` - Assign groups to users

#### Roles (5 permissions)
- `roles.view` - View roles
- `roles.create` - Create roles
- `roles.update` - Update roles
- `roles.delete` - Delete roles
- `roles.assign_permissions` - Assign permissions to roles

#### Permissions (4 permissions)
- `permissions.view` - View permissions
- `permissions.create` - Create permissions
- `permissions.update` - Update permissions
- `permissions.delete` - Delete permissions

#### Groups (4 permissions)
- `groups.view` - View user groups
- `groups.create` - Create user groups
- `groups.update` - Update user groups
- `groups.delete` - Delete user groups

### General (7 permissions)
- `dashboard.view` - View dashboard
- `reports.view` - View reports
- `reports.export` - Export reports
- `audit.view` - View audit logs
- `logs.view` - View system logs

## Roles

### 1. Super Administrator
**Description:** Full system access with all permissions. Can manage system settings, users, roles, and all RADIUS configurations.

**Permissions:** All 73 permissions

**Use Case:** System owners, platform administrators

---

### 2. Administrator
**Description:** Workspace administrator with full access to RADIUS management and workspace settings. Cannot manage global system settings.

**Permissions:** All permissions except:
- OIDC settings (`settings.oidc.*`)
- Permission management (`permissions.*`)
- User deletion (`users.delete`)

**Use Case:** Workspace administrators, senior IT staff

---

### 3. Workspace Manager
**Description:** Can manage workspace settings and RADIUS configurations. Cannot manage users or system settings.

**Permissions:**
- All workspace permissions (`workspace.*`)
- All RADIUS permissions (`radius.*`)
- All integration permissions (`integration.*`)
- Dashboard and reports viewing

**Use Case:** Team leads, department managers

---

### 4. RADIUS Operator
**Description:** Can create, update, and delete RADIUS users, profiles, groups, and tags. Limited workspace access.

**Permissions:**
- All RADIUS permissions (`radius.*`)
- Workspace viewing and switching
- Dashboard viewing

**Use Case:** Network operators, daily operational staff

---

### 5. RADIUS Viewer
**Description:** Read-only access to RADIUS configurations. Can view users, profiles, groups, and tags but cannot modify them.

**Permissions:**
- All view permissions for RADIUS (`radius.*.view`)
- Workspace viewing
- Dashboard viewing

**Use Case:** Auditors, reporting staff, read-only analysts

---

### 6. Integration Manager
**Description:** Can manage SAS RADIUS integration and sync operations. Limited access to other features.

**Permissions:**
- All integration permissions (`integration.*`)
- View RADIUS users, profiles, and groups
- Workspace viewing
- Dashboard viewing

**Use Case:** Integration specialists, third-party system administrators

---

### 7. User Manager
**Description:** Can manage users, assign roles and groups. Cannot manage roles, permissions, or system settings.

**Permissions:**
- All user management permissions (`users.*`)
- View groups and roles
- Dashboard viewing

**Use Case:** HR personnel, user account administrators

---

### 8. Auditor
**Description:** Read-only access to all data including audit logs and reports. Cannot modify any data.

**Permissions:**
- All view permissions (any permission ending with `.view`)
- Audit log viewing (`audit.view`)
- System logs viewing (`logs.view`)
- Report export (`reports.export`)

**Use Case:** Compliance officers, security auditors

---

### 9. Viewer
**Description:** Basic read-only access to dashboard and assigned workspace data.

**Permissions:**
- Dashboard viewing (`dashboard.view`)
- Workspace viewing (`workspace.view`)

**Use Case:** External stakeholders, basic users

## Groups

### 1. IT Department
**Description:** Information Technology department members

**Suggested Roles:** Administrator, Workspace Manager, RADIUS Operator

---

### 2. Network Operations
**Description:** Network operations and infrastructure team

**Suggested Roles:** RADIUS Operator, Integration Manager, Workspace Manager

---

### 3. Security Team
**Description:** Information security and compliance team

**Suggested Roles:** Auditor, Administrator, RADIUS Viewer

---

### 4. Support Team
**Description:** Customer and technical support team

**Suggested Roles:** RADIUS Viewer, User Manager, Viewer

---

### 5. Management
**Description:** Executive and management team members

**Suggested Roles:** Viewer, Auditor

---

### 6. Development Team
**Description:** Software development and engineering team

**Suggested Roles:** Super Administrator, Administrator (for development/testing)

---

### 7. Integration Specialists
**Description:** Team responsible for third-party integrations

**Suggested Roles:** Integration Manager, RADIUS Operator

---

### 8. Compliance Officers
**Description:** Regulatory compliance and audit personnel

**Suggested Roles:** Auditor, Viewer

## Usage

### Automatic Seeding

The seed data is automatically loaded when the application starts:

```csharp
using (var scope = app.Services.CreateScope())
{
    var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
    masterContext.Database.Migrate();
    
    // Seed roles, permissions, and groups
    SeedData.Initialize(masterContext);
}
```

### Manual Seeding

If you need to manually seed the database:

1. Delete existing roles, permissions, and groups from the database
2. Restart the application - seed data will be automatically added

### Customization

To customize the seed data:

1. Edit `Backend/Data/SeedData.cs`
2. Modify the permission, role, or group definitions
3. Restart the application

**Note:** Changes to seed data will only affect new installations. Existing databases will need manual updates or migrations.

## Best Practices

1. **Assign roles, not individual permissions** - Always assign users to roles rather than granting individual permissions
2. **Use groups for organization** - Group users by department or function for easier management
3. **Follow least privilege** - Assign the minimum role necessary for users to perform their tasks
4. **Regular audits** - Use the Auditor role to regularly review access and permissions
5. **Custom roles** - For complex scenarios, create custom roles with specific permission sets

## Security Considerations

- **Super Administrator** role should be limited to a very small number of trusted users
- **OIDC settings** should only be accessible to Super Administrators
- **Permission management** is restricted to prevent privilege escalation
- **User deletion** requires careful consideration and is limited in most roles
- **Audit logs** should be regularly reviewed for security events

## Related Documentation

- [Multi-Tenant Implementation](./MULTI_TENANT_IMPLEMENTATION.md)
- [OIDC Authentication](./OIDC_AUTHENTICATION.md)
- [Backend README](./Backend-README.md)
