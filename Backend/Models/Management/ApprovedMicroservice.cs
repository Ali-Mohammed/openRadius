using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

/// <summary>
/// Represents an approved microservice in the system.
/// Stores the configuration and metadata for approved service connections.
/// </summary>
[Table("approved_microservices")]
public class ApprovedMicroservice
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    /// <summary>
    /// The unique service identifier (e.g., "RadiusSyncService").
    /// This is the technical name used for connection matching.
    /// </summary>
    [Required]
    [Column("service_id")]
    [MaxLength(100)]
    public string ServiceId { get; set; } = string.Empty;

    /// <summary>
    /// The display name for the service (e.g., "Radius Sync Service - Production").
    /// This is the friendly name shown in the dashboard.
    /// </summary>
    [Required]
    [Column("display_name")]
    [MaxLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// When the service was first approved.
    /// </summary>
    [Column("approved_at")]
    public DateTime ApprovedAt { get; set; }

    /// <summary>
    /// Who approved the service (user ID or admin name).
    /// </summary>
    [Column("approved_by")]
    [MaxLength(100)]
    public string? ApprovedBy { get; set; }

    /// <summary>
    /// Last time this service successfully connected.
    /// </summary>
    [Column("last_connected_at")]
    public DateTime? LastConnectedAt { get; set; }

    /// <summary>
    /// IP address of the last connection (for security auditing).
    /// </summary>
    [Column("last_ip_address")]
    [MaxLength(45)] // IPv6 max length
    public string? LastIpAddress { get; set; }

    /// <summary>
    /// Whether this approval is still active.
    /// Set to false to revoke access without deleting the record.
    /// </summary>
    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Optional notes about this microservice.
    /// </summary>
    [Column("notes")]
    public string? Notes { get; set; }

    /// <summary>
    /// Created timestamp.
    /// </summary>
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Updated timestamp.
    /// </summary>
    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
