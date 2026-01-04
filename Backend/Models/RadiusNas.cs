namespace Backend.Models
{
    /// <summary>
    /// Represents a Network Access Server (NAS) in the RADIUS system.
    /// NAS devices are responsible for authenticating users and managing network access.
    /// </summary>
    public class RadiusNas
    {
        /// <summary>
        /// Primary key for the NAS record
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// IP address or hostname of the NAS device
        /// </summary>
        public string Nasname { get; set; } = string.Empty;

        /// <summary>
        /// Short descriptive name for the NAS (e.g., "PPPoE-1")
        /// </summary>
        public string Shortname { get; set; } = string.Empty;

        /// <summary>
        /// Type of NAS device (numeric identifier)
        /// </summary>
        public int Type { get; set; }

        /// <summary>
        /// Shared secret for RADIUS authentication
        /// </summary>
        public string Secret { get; set; } = string.Empty;

        /// <summary>
        /// API username for NAS management
        /// </summary>
        public string? ApiUsername { get; set; }

        /// <summary>
        /// API password for NAS management
        /// </summary>
        public string? ApiPassword { get; set; }

        /// <summary>
        /// Change of Authorization (CoA) port number
        /// </summary>
        public int CoaPort { get; set; } = 1700;

        /// <summary>
        /// NAS device version/model (e.g., "cisco_asr_9xxx")
        /// </summary>
        public string? Version { get; set; }

        /// <summary>
        /// Description of the NAS device
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// Server identifier
        /// </summary>
        public string? Server { get; set; }

        /// <summary>
        /// Whether the NAS is enabled (1 = enabled, 0 = disabled)
        /// </summary>
        public int Enabled { get; set; } = 1;

        /// <summary>
        /// Site identifier for the NAS location
        /// </summary>
        public int? SiteId { get; set; }

        /// <summary>
        /// HTTP port for NAS management
        /// </summary>
        public int HttpPort { get; set; } = 80;

        /// <summary>
        /// Whether monitoring is enabled (1 = enabled, 0 = disabled)
        /// </summary>
        public int Monitor { get; set; } = 1;

        /// <summary>
        /// Last ping response time in milliseconds (-1 = not available)
        /// </summary>
        public int PingTime { get; set; } = -1;

        /// <summary>
        /// Ping packet loss percentage
        /// </summary>
        public int PingLoss { get; set; } = 100;

        /// <summary>
        /// Whether IP accounting is enabled (1 = enabled, 0 = disabled)
        /// </summary>
        public int IpAccountingEnabled { get; set; } = 1;

        /// <summary>
        /// IP address pool name
        /// </summary>
        public string? PoolName { get; set; }

        /// <summary>
        /// API port for NAS management
        /// </summary>
        public int? ApiPort { get; set; }

        /// <summary>
        /// SNMP community string for monitoring
        /// </summary>
        public string? SnmpCommunity { get; set; }

        /// <summary>
        /// SSH username for device access
        /// </summary>
        public string? SshUsername { get; set; }

        /// <summary>
        /// SSH password for device access
        /// </summary>
        public string? SshPassword { get; set; }

        /// <summary>
        /// SSH port number
        /// </summary>
        public int SshPort { get; set; } = 22;

        /// <summary>
        /// User ID who created this NAS record
        /// </summary>
        public int CreatedBy { get; set; }

        /// <summary>
        /// Timestamp when the record was created
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Timestamp when the record was last updated
        /// </summary>
        public DateTime UpdatedAt { get; set; }

        /// <summary>
        /// Soft delete flag
        /// </summary>
        public bool IsDeleted { get; set; }

        /// <summary>
        /// Timestamp when the record was soft deleted
        /// </summary>
        public DateTime? DeletedAt { get; set; }

        /// <summary>
        /// Foreign key to the workspace
        /// </summary>
        public int WorkspaceId { get; set; }
    }

    /// <summary>
    /// Request model for creating a new NAS
    /// </summary>
    public class CreateRadiusNasRequest
    {
        public string Nasname { get; set; } = string.Empty;
        public string Shortname { get; set; } = string.Empty;
        public int Type { get; set; }
        public string Secret { get; set; } = string.Empty;
        public string? ApiUsername { get; set; }
        public string? ApiPassword { get; set; }
        public int CoaPort { get; set; } = 1700;
        public string? Version { get; set; }
        public string? Description { get; set; }
        public string? Server { get; set; }
        public int Enabled { get; set; } = 1;
        public int? SiteId { get; set; }
        public int HttpPort { get; set; } = 80;
        public int Monitor { get; set; } = 1;
        public int IpAccountingEnabled { get; set; } = 1;
        public string? PoolName { get; set; }
        public int? ApiPort { get; set; }
        public string? SnmpCommunity { get; set; }
        public string? SshUsername { get; set; }
        public string? SshPassword { get; set; }
        public int SshPort { get; set; } = 22;
    }

    /// <summary>
    /// Request model for updating an existing NAS
    /// </summary>
    public class UpdateRadiusNasRequest
    {
        public string? Nasname { get; set; }
        public string? Shortname { get; set; }
        public int? Type { get; set; }
        public string? Secret { get; set; }
        public string? ApiUsername { get; set; }
        public string? ApiPassword { get; set; }
        public int? CoaPort { get; set; }
        public string? Version { get; set; }
        public string? Description { get; set; }
        public string? Server { get; set; }
        public int? Enabled { get; set; }
        public int? SiteId { get; set; }
        public int? HttpPort { get; set; }
        public int? Monitor { get; set; }
        public int? IpAccountingEnabled { get; set; }
        public string? PoolName { get; set; }
        public int? ApiPort { get; set; }
        public string? SnmpCommunity { get; set; }
        public string? SshUsername { get; set; }
        public string? SshPassword { get; set; }
        public int? SshPort { get; set; }
    }
}
