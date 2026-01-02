namespace Backend.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Multi-tenant support: Default and current instant selection
    public int? DefaultInstantId { get; set; }
    public int? CurrentInstantId { get; set; }
    
    // Navigation properties
    public Instant? DefaultInstant { get; set; }
    public Instant? CurrentInstant { get; set; }
}
