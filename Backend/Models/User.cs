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
    public bool Enabled { get; set; } = true;
    
    // Supervisor relationship
    public int? SupervisorId { get; set; }
    public User? Supervisor { get; set; }
    
    // Multi-tenant support: Default and current workspace selection
    public int? DefaultWorkspaceId { get; set; }
    public int? CurrentWorkspaceId { get; set; }
    
    // Navigation properties
    public Workspace? DefaultWorkspace { get; set; }
    public Workspace? CurrentWorkspace { get; set; }
    public ICollection<User> Subordinates { get; set; } = new List<User>();
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<UserGroup> UserGroups { get; set; } = new List<UserGroup>();
}

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class Group
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<UserGroup> UserGroups { get; set; } = new List<UserGroup>();
}

public class Permission
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "General"; // e.g., "Users", "Workspaces", "RADIUS", "Reports"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
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
