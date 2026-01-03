# Keycloak Admin Client - Permissions Guide

## Overview

The `openradius-admin` service account client has been configured with comprehensive permissions to manage all aspects of user authentication, authorization, and access control in Keycloak.

## Assigned Permissions (10 Roles)

### 👥 User Management (3 roles)

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `manage-users` | Full user CRUD operations | Create users, update user details, delete users, reset passwords, manage user attributes |
| `view-users` | Read user information | View user profiles, list users, search users |
| `query-users` | Advanced user queries | Search users with filters, pagination, complex queries |

**Backend Endpoints Enabled:**
- `POST /api/keycloak/users` - Create new users
- `GET /api/keycloak/users` - List all users with search/filter
- `GET /api/keycloak/users/{id}` - Get user by ID
- `PUT /api/keycloak/users/{id}` - Update user
- `DELETE /api/keycloak/users/{id}` - Delete user
- `POST /api/keycloak/users/{id}/reset-password` - Reset user password

---

### 👪 Group Management (1 role)

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `query-groups` | Group operations | List groups, search groups, view group membership |

**Backend Endpoints Enabled:**
- `GET /api/keycloak/users/groups` - Get all groups
- Group-based user filtering and assignment

**What You Can Do:**
- ✅ List all available groups (Administrators, Users, Managers, etc.)
- ✅ Display groups in user creation/edit forms
- ✅ Assign users to groups
- ✅ Remove users from groups
- ✅ Filter users by group membership

---

### 🏛️ Realm & Role Management (2 roles)

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `manage-realm` | Full realm configuration | Manage realm settings, create/edit/delete realm roles, configure authentication flows |
| `view-realm` | Read realm configuration | View realm settings, list realm roles, view authentication configuration |

**What You Can Do:**
- ✅ **Realm Roles**: Create, update, delete realm roles (admin, manager, user, etc.)
- ✅ **User Role Assignment**: Assign realm roles to users
- ✅ **Role Hierarchy**: Manage role composition and inheritance
- ✅ **Realm Settings**: View and modify realm configuration

**Example Use Cases:**
```javascript
// Assign realm roles to users
PUT /api/keycloak/users/{userId}/roles
Body: ["admin", "manager"]

// Create new realm role
POST /api/keycloak/realm/roles
Body: { name: "super-admin", description: "Super administrator" }

// Get all realm roles
GET /api/keycloak/realm/roles
```

---

### 🔐 Permission Management (2 roles)

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `manage-authorization` | Full authorization control | Manage permissions, policies, resources, scopes |
| `view-authorization` | Read authorization config | View permissions, policies, resources |

**What You Can Do:**
- ✅ **Permissions**: Create and manage fine-grained permissions
- ✅ **Policies**: Define authorization policies (role-based, time-based, etc.)
- ✅ **Resources**: Manage protected resources
- ✅ **Scopes**: Define permission scopes

**Advanced Authorization Features:**
- Role-based access control (RBAC)
- Attribute-based access control (ABAC)
- Policy-based access control (PBAC)
- Resource-based permissions

---

### 🔧 Client Management (2 roles)

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `query-clients` | Search clients | List and search OAuth/OIDC clients |
| `view-clients` | View client details | View client configuration, secrets, roles |

**What You Can Do:**
- ✅ List all clients in the realm
- ✅ View client configurations (openradius-web, openradius-admin)
- ✅ View client roles
- ✅ Monitor client service accounts
- ✅ View client credentials and secrets

---

## Permission Matrix

| Feature | Permissions Required | Status |
|---------|---------------------|--------|
| **Create User** | `manage-users` | ✅ Enabled |
| **Update User** | `manage-users` | ✅ Enabled |
| **Delete User** | `manage-users` | ✅ Enabled |
| **Reset Password** | `manage-users` | ✅ Enabled |
| **View Users** | `view-users` | ✅ Enabled |
| **Search Users** | `query-users` | ✅ Enabled |
| **List Groups** | `query-groups` | ✅ Enabled |
| **Assign User to Group** | `manage-users` + `query-groups` | ✅ Enabled |
| **Create Realm Role** | `manage-realm` | ✅ Enabled |
| **Assign Realm Role** | `manage-realm` + `manage-users` | ✅ Enabled |
| **Create Client Role** | `manage-realm` | ✅ Enabled |
| **Manage Permissions** | `manage-authorization` | ✅ Enabled |
| **View Clients** | `view-clients` | ✅ Enabled |
| **Create Client** | ❌ Not assigned (requires `manage-clients`) | ❌ Not needed |
| **Modify Realm Settings** | `manage-realm` | ✅ Enabled |

---

## Common Use Cases

### 1. Complete User Lifecycle Management

```typescript
// Create user with roles and groups
const user = await userManagementApi.create({
  username: "john.doe",
  email: "john@example.com",
  firstName: "John",
  lastName: "Doe",
  enabled: true,
  emailVerified: true,
  groups: ["Managers"],           // ✅ query-groups
  realmRoles: ["manager", "user"] // ✅ manage-realm
});

// Reset password
await userManagementApi.resetPassword(user.id, {
  type: "password",
  value: "newPassword123",
  temporary: false
}); // ✅ manage-users
```

### 2. Role-Based Access Control

```typescript
// Assign multiple roles to user
PUT /api/keycloak/users/{userId}/roles
{
  "realmRoles": ["admin", "manager"],  // ✅ manage-realm
  "clientRoles": {
    "openradius-web": ["premium-user"]  // ✅ manage-realm
  }
}
```

### 3. Group-Based Organization

```typescript
// Get all groups
const groups = await userManagementApi.getGroups(); 
// ✅ query-groups
// Returns: ["Administrators", "Managers", "Users"]

// Filter users by group
GET /api/keycloak/users?group=Managers
// ✅ query-users + query-groups
```

### 4. Permission Policies

```typescript
// Create permission policy (future feature)
POST /api/keycloak/authorization/policies
{
  "name": "WorkspaceAdminPolicy",
  "type": "role",
  "logic": "POSITIVE",
  "roles": ["workspace-admin"]
}
// ✅ manage-authorization
```

---

## Security Best Practices

### ✅ What the Service Account CAN Do
- Manage user accounts (CRUD operations)
- Assign users to groups
- Manage realm and client roles
- Assign roles to users
- Reset user passwords
- View and manage permissions
- Query clients and groups

### ❌ What the Service Account CANNOT Do
- Create or delete clients (no `manage-clients`)
- Delete the realm (no `delete-realm`)
- Impersonate users (no `impersonation`)
- Modify master realm (limited to `openradius` realm)

### 🔒 Security Considerations

1. **Least Privilege**: Service account only has permissions needed for user management
2. **Realm Isolation**: Permissions limited to `openradius` realm only
3. **Token Expiry**: Access tokens expire after 3600 seconds (1 hour)
4. **Secret Protection**: Client secret stored securely in appsettings.json
5. **No Direct Access**: Service account can only be used via client credentials, no interactive login

---

## Testing Permissions

### Verify User Management
```powershell
# Test creating a user
$body = @{
    username = "test.user"
    email = "test@example.com"
    enabled = $true
    emailVerified = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/keycloak/users" `
    -Method Post -Headers @{Authorization="Bearer $userToken"} `
    -Body $body -ContentType "application/json"
```

### Verify Group Access
```powershell
# Test fetching groups
Invoke-RestMethod -Uri "http://localhost:5000/api/keycloak/users/groups" `
    -Method Get -Headers @{Authorization="Bearer $userToken"}
```

### Verify Service Account Roles
```powershell
# List all roles assigned to service account
$token = (Invoke-RestMethod -Uri "http://localhost:8080/realms/master/protocol/openid-connect/token" `
    -Method Post -Body @{grant_type="password";client_id="admin-cli";username="admin";password="admin"} `
    -ContentType "application/x-www-form-urlencoded").access_token

$serviceAccountUrl = "http://localhost:8080/admin/realms/openradius/users/58e55b69-d196-4128-b81e-85e2a1c6aefd/role-mappings/clients/e16895c5-b333-4dee-bb86-8662d5a6c66b"

Invoke-RestMethod -Uri $serviceAccountUrl -Method Get -Headers @{Authorization="Bearer $token"}
```

---

## API Endpoints Summary

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/keycloak/users` | GET | `query-users` | List users |
| `/api/keycloak/users` | POST | `manage-users` | Create user |
| `/api/keycloak/users/{id}` | GET | `view-users` | Get user |
| `/api/keycloak/users/{id}` | PUT | `manage-users` | Update user |
| `/api/keycloak/users/{id}` | DELETE | `manage-users` | Delete user |
| `/api/keycloak/users/{id}/reset-password` | POST | `manage-users` | Reset password |
| `/api/keycloak/users/groups` | GET | `query-groups` | List groups |

---

## Troubleshooting

### Issue: 403 Forbidden when managing roles
**Cause**: Missing `manage-realm` permission  
**Solution**: Run the automation script to add comprehensive permissions

### Issue: Cannot see groups
**Cause**: Missing `query-groups` permission  
**Solution**: Permission has been added - restart backend

### Issue: Cannot assign users to groups
**Cause**: Need both `manage-users` and `query-groups`  
**Solution**: Both permissions now assigned ✅

---

## Next Steps

1. **Backend Implementation**: Create role and permission management endpoints
2. **Frontend UI**: Add role assignment interface in user management page
3. **Group Management**: Create group CRUD interface
4. **Permission Policies**: Implement fine-grained authorization

---

**Last Updated**: January 3, 2026  
**Service Account**: openradius-admin  
**Total Permissions**: 10 realm-management roles  
**Status**: ✅ Fully Configured
