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
}
