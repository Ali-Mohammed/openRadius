namespace Backend.Models;

public class SasRadiusIntegration
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Url { get; set; }
    public required string Username { get; set; }
    public required string Password { get; set; }
    public bool UseHttps { get; set; }
    public bool IsActive { get; set; }
    public int MaxItemInPagePerRequest { get; set; } = 100; // Items per page for each API request
    public string? Action { get; set; }
    public string? Description { get; set; }
    public bool SendActivationsToSas { get; set; } = false; // Send activations to SAS4 for active users

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}


