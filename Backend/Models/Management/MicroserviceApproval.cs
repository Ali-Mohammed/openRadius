namespace Backend.Models;

public class MicroserviceApproval
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string ServiceName { get; set; } = string.Empty;
    public string MachineId { get; set; } = string.Empty;
    public string ApprovalToken { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsApproved { get; set; }
    public DateTime ApprovedAt { get; set; }
    public DateTime LastConnectedAt { get; set; }
    public string ApprovedBy { get; set; } = string.Empty;
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }
}
