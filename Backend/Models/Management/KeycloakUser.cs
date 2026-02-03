namespace Backend.Models;

public class KeycloakUserRequest
{
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool Enabled { get; set; } = true;
    public bool EmailVerified { get; set; } = false;
    public List<string>? Groups { get; set; }
    public string? SupervisorId { get; set; }
    public Dictionary<string, List<string>>? Attributes { get; set; }
    public string? Password { get; set; }
    public bool TemporaryPassword { get; set; } = false;
    public string? DisabledReason { get; set; }
}

public class KeycloakUserResponse
{
    public string? Id { get; set; }
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool Enabled { get; set; }
    public bool EmailVerified { get; set; }
    public long? CreatedTimestamp { get; set; }
    public List<string>? Groups { get; set; }
    public List<string>? RealmRoles { get; set; }
    public string? SupervisorId { get; set; }
    public string? Supervisor { get; set; }
    public Dictionary<string, List<string>>? Attributes { get; set; }
    public List<ZoneInfo>? Zones { get; set; }
}

public class ZoneInfo
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
}

public class KeycloakGroupResponse
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Path { get; set; }
}

public class KeycloakRoleResponse
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool Composite { get; set; }
    public bool ClientRole { get; set; }
}

public class SetPasswordRequest
{
    public string? Password { get; set; }
    public bool Temporary { get; set; } = false;
}
