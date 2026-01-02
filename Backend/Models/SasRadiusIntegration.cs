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
    public int MaxPagesPerRequest { get; set; } = 10;
    public string? Action { get; set; }
    public string? Description { get; set; }
    public int InstantId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
