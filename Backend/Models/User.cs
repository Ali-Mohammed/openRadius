using System.Text.Json.Serialization;

namespace Backend.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Keycloak integration
    public string? KeycloakUserId { get; set; }
    
    // Supervisor relationship
    public int? SupervisorId { get; set; }
    
    // Multi-tenant support: Default and current workspace selection
    public int? DefaultWorkspaceId { get; set; }
    public int? CurrentWorkspaceId { get; set; }
    
    // User status tracking
    public string? DisabledReason { get; set; }
    public DateTime? DisabledAt { get; set; }
    public string? DisabledBy { get; set; }
    
    // Navigation properties - Only ignore circular references
    [JsonIgnore]
    public Workspace? DefaultWorkspace { get; set; }
    [JsonIgnore]
    public Workspace? CurrentWorkspace { get; set; }
    [JsonIgnore]
    public User? Supervisor { get; set; }
    [JsonIgnore]
    public ICollection<User> Subordinates { get; set; } = new List<User>();
    [JsonIgnore]
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    [JsonIgnore]
    public ICollection<UserGroup> UserGroups { get; set; } = new List<UserGroup>();
    [JsonIgnore]
    public ICollection<UserWorkspace> UserWorkspaces { get; set; } = new List<UserWorkspace>();
}

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class Group
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    
    public ICollection<UserGroup> UserGroups { get; set; } = new List<UserGroup>();
}

public class Permission
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "General"; // e.g., "Users", "Workspaces", "RADIUS", "Reports"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class UserRole
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}

public class UserGroup
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    
    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;
    
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}

public class RolePermission
{
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    
    public int PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
    
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}

public class UserWorkspace
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    
    public int WorkspaceId { get; set; }
    public Workspace Workspace { get; set; } = null!;
    
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public string? AssignedBy { get; set; }
}
