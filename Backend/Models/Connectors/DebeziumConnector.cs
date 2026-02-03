namespace Backend.Models;

public class DebeziumConnector
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string ConnectorClass { get; set; } = string.Empty;
    public string DatabaseHostname { get; set; } = string.Empty;
    public int DatabasePort { get; set; } = 5432;
    public string DatabaseUser { get; set; } = string.Empty;
    public string DatabasePassword { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;
    public string DatabaseServerName { get; set; } = string.Empty;
    public string PluginName { get; set; } = "pgoutput";
    public string SlotName { get; set; } = string.Empty;
    public string PublicationAutocreateMode { get; set; } = "filtered";
    public string TableIncludeList { get; set; } = string.Empty;
    public string SnapshotMode { get; set; } = "initial";
    public string? AdditionalConfig { get; set; } // JSON for any additional properties
    public string Status { get; set; } = "UNASSIGNED"; // RUNNING, PAUSED, FAILED, UNASSIGNED
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
