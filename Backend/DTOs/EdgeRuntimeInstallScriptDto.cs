namespace Backend.DTOs;

/// <summary>
/// Request parameters for generating an Edge Runtime install script.
/// </summary>
public class EdgeRuntimeInstallScriptRequest
{
    /// <summary>
    /// The Kafka bootstrap server address (e.g., kafka.example.com:9092).
    /// </summary>
    public string KafkaBootstrapServer { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated list of Kafka topics to subscribe (e.g., workspace_1.public.RadiusUsers).
    /// </summary>
    public string Topics { get; set; } = string.Empty;

    /// <summary>
    /// The Debezium server name / topic prefix.
    /// </summary>
    public string ServerName { get; set; } = string.Empty;

    /// <summary>
    /// The name for this edge runtime instance (e.g., branch-office-1).
    /// </summary>
    public string InstanceName { get; set; } = "edge-runtime";

    /// <summary>
    /// The local PostgreSQL port to expose on the edge server.
    /// </summary>
    public int PostgresPort { get; set; } = 5434;

    /// <summary>
    /// The local Kafka Connect REST port to expose.
    /// </summary>
    public int ConnectPort { get; set; } = 8084;

    /// <summary>
    /// The connector group ID (must be unique per edge instance).
    /// </summary>
    public int ConnectorGroupId { get; set; } = 2;

    /// <summary>
    /// When true, persist the script on the server and return a public download URL.
    /// When false (default), only return the script in-memory without saving.
    /// </summary>
    public bool SaveToServer { get; set; } = false;
}

/// <summary>
/// Response containing the generated install script and metadata.
/// </summary>
public class EdgeRuntimeInstallScriptResponse
{
    /// <summary>
    /// The generated bash install script content.
    /// </summary>
    public string Script { get; set; } = string.Empty;

    /// <summary>
    /// The instance name used in the script.
    /// </summary>
    public string InstanceName { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable description of what the script will install.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// The version of the Edge Runtime installer.
    /// </summary>
    public string Version { get; set; } = "1.0.0";

    /// <summary>
    /// The UUID of the persisted script (only set when SaveToServer = true).
    /// </summary>
    public Guid? ScriptId { get; set; }

    /// <summary>
    /// The public download URL (only set when SaveToServer = true).
    /// e.g., https://api.example.com/api/debezium/edge-runtime/scripts/{uuid}
    /// </summary>
    public string? PublicUrl { get; set; }

    /// <summary>
    /// The one-liner install command (only set when SaveToServer = true).
    /// e.g., curl -sSL https://api.example.com/api/debezium/edge-runtime/scripts/{uuid} | sudo bash
    /// </summary>
    public string? InstallCommand { get; set; }

    /// <summary>
    /// When the script was persisted on the server.
    /// </summary>
    public DateTime? CreatedAt { get; set; }
}

/// <summary>
/// Summary DTO for listing saved Edge Runtime scripts (no full script content).
/// </summary>
public class EdgeRuntimeScriptSummaryDto
{
    public Guid Uuid { get; set; }
    public int WorkspaceId { get; set; }
    public string InstanceName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string KafkaBootstrapServer { get; set; } = string.Empty;
    public string Topics { get; set; } = string.Empty;
    public string ServerName { get; set; } = string.Empty;
    public int PostgresPort { get; set; }
    public int ConnectPort { get; set; }
    public int DownloadCount { get; set; }
    public DateTime? LastDownloadedAt { get; set; }
    public string? PublicUrl { get; set; }
    public string? InstallCommand { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}
