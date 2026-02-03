namespace Backend.Models;

public class DebeziumSettings
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string ConnectUrl { get; set; } = "http://localhost:8083";
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool IsDefault { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
