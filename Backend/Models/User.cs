namespace Backend.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Multi-tenant support: Default and current workspace selection
    public int? DefaultWorkspaceId { get; set; }
    public int? CurrentWorkspaceId { get; set; }
    
    // Navigation properties
    public Workspace? DefaultWorkspace { get; set; }
    public Workspace? CurrentWorkspace { get; set; }
}


