using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

/// <summary>
/// Persisted Edge Runtime install script.
/// Each generated script is saved to the database with a UUID that forms
/// a public, unauthenticated download URL:
///   GET /api/debezium/edge-runtime/scripts/{uuid}
/// This enables one-liner installs: curl -sSL https://…/scripts/{uuid} | sudo bash
/// </summary>
public class EdgeRuntimeScript
{
    [Key]
    public int Id { get; set; }

    /// <summary>Public identifier — used in the download URL. Never expose internal Id.</summary>
    public Guid Uuid { get; set; } = Guid.NewGuid();

    /// <summary>Human-friendly instance name (e.g., branch-office-1).</summary>
    [Required]
    [MaxLength(128)]
    public string InstanceName { get; set; } = string.Empty;

    /// <summary>Human-readable description of what the script deploys.</summary>
    [MaxLength(1024)]
    public string Description { get; set; } = string.Empty;

    /// <summary>Installer version that generated this script.</summary>
    [MaxLength(20)]
    public string Version { get; set; } = "1.0.0";

    /// <summary>The full bash script content.</summary>
    [Required]
    public string ScriptContent { get; set; } = string.Empty;

    /// <summary>Kafka bootstrap server used in the script.</summary>
    [MaxLength(256)]
    public string KafkaBootstrapServer { get; set; } = string.Empty;

    /// <summary>Comma-separated Kafka topics the script subscribes to.</summary>
    [MaxLength(1024)]
    public string Topics { get; set; } = string.Empty;

    /// <summary>Debezium server/topic prefix.</summary>
    [MaxLength(128)]
    public string ServerName { get; set; } = string.Empty;

    /// <summary>PostgreSQL port exposed on the edge server.</summary>
    public int PostgresPort { get; set; } = 5434;

    /// <summary>Kafka Connect REST port exposed on the edge server.</summary>
    public int ConnectPort { get; set; } = 8084;

    /// <summary>Connector group ID used in the script.</summary>
    public int ConnectorGroupId { get; set; } = 2;

    /// <summary>How many times this script has been downloaded.</summary>
    public int DownloadCount { get; set; } = 0;

    /// <summary>When the script was last downloaded (null if never).</summary>
    public DateTime? LastDownloadedAt { get; set; }

    // ── Audit Fields ─────────────────────────────────────────────────────

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(256)]
    public string? CreatedBy { get; set; }

    public DateTime? UpdatedAt { get; set; }

    [MaxLength(256)]
    public string? UpdatedBy { get; set; }

    public bool IsDeleted { get; set; } = false;

    public DateTime? DeletedAt { get; set; }

    [MaxLength(256)]
    public string? DeletedBy { get; set; }
}
