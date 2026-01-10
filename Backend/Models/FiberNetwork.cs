using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class Olt
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    // Identification
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Hostname { get; set; }

    [Required]
    [StringLength(50)]
    public string Vendor { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Model { get; set; } = string.Empty;

    [StringLength(100)]
    public string? SerialNumber { get; set; }

    [StringLength(50)]
    public string? AssetTag { get; set; }

    [StringLength(50)]
    public string? Role { get; set; }

    [StringLength(20)]
    public string Environment { get; set; } = "prod"; // prod, test, dev

    [StringLength(20)]
    public string Status { get; set; } = "active"; // active, inactive, maintenance, decommissioned

    // Network
    [Required]
    [StringLength(50)]
    public string ManagementIp { get; set; } = string.Empty;

    public int? ManagementVlan { get; set; }

    [StringLength(50)]
    public string? LoopbackIp { get; set; }

    [StringLength(50)]
    public string? MgmtInterface { get; set; }

    // SSH
    public bool SshEnabled { get; set; } = true;
    public int SshPort { get; set; } = 22;

    [StringLength(100)]
    public string? SshUsername { get; set; }

    [StringLength(50)]
    public string? SshAuthType { get; set; } // password, key, both

    [StringLength(255)]
    public string? SshPasswordRef { get; set; }

    [StringLength(255)]
    public string? SshPrivateKeyRef { get; set; }

    // SNMP
    [StringLength(20)]
    public string? SnmpVersion { get; set; } // v1, v2c, v3

    public int SnmpPort { get; set; } = 161;
    public int SnmpTimeoutMs { get; set; } = 2000;
    public int SnmpRetries { get; set; } = 3;

    [StringLength(255)]
    public string? SnmpCommunityRef { get; set; }

    [StringLength(100)]
    public string? SnmpV3User { get; set; }

    [StringLength(20)]
    public string? SnmpV3AuthProtocol { get; set; }

    [StringLength(20)]
    public string? SnmpV3PrivProtocol { get; set; }

    [StringLength(255)]
    public string? SnmpV3AuthKeyRef { get; set; }

    [StringLength(255)]
    public string? SnmpV3PrivKeyRef { get; set; }

    // API
    [StringLength(255)]
    public string? ApiEndpoint { get; set; }

    [StringLength(50)]
    public string? ApiVersion { get; set; }

    [StringLength(255)]
    public string? ApiTokenRef { get; set; }

    public int? ApiTimeoutMs { get; set; }

    // Monitoring
    public DateTime? LastSnmpPollAt { get; set; }
    public DateTime? LastSshLoginAt { get; set; }
    public long? UptimeSeconds { get; set; }
    public decimal? CpuUsagePct { get; set; }
    public decimal? MemoryUsagePct { get; set; }
    public decimal? TemperatureC { get; set; }

    // Location
    [StringLength(100)]
    public string? SiteName { get; set; }

    [StringLength(50)]
    public string? Rack { get; set; }

    public int? RackUnit { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation
    public virtual ICollection<PonPort> PonPorts { get; set; } = new List<PonPort>();
}

public class PonPort
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid OltId { get; set; }

    public int Slot { get; set; }
    public int Port { get; set; }

    [Required]
    [StringLength(20)]
    public string Technology { get; set; } = string.Empty; // GPON, EPON, XGS-PON

    public int? MaxSplitRatio { get; set; }
    public int? CurrentSplitRatio { get; set; }
    public decimal? TxPowerDbm { get; set; }
    public decimal? RxPowerDbm { get; set; }

    [StringLength(20)]
    public string Status { get; set; } = "active";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation
    public virtual Olt? Olt { get; set; }
    public virtual ICollection<Fdt> Fdts { get; set; } = new List<Fdt>();
}

public class Fdt
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Name { get; set; }

    [Required]
    public Guid PonPortId { get; set; }

    [StringLength(50)]
    public string? Cabinet { get; set; } // indoor, outdoor, pole

    public int Capacity { get; set; }
    public int UsedPorts { get; set; } = 0;

    [StringLength(20)]
    public string? SplitRatio { get; set; }

    public DateTime? InstallationDate { get; set; }

    [StringLength(20)]
    public string Status { get; set; } = "active";

    public string? Address { get; set; }

    [StringLength(100)]
    public string? Zone { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation
    public virtual PonPort? PonPort { get; set; }
    public virtual ICollection<Fat> Fats { get; set; } = new List<Fat>();
}

public class Fat
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Name { get; set; }

    [Required]
    public Guid FdtId { get; set; }

    public int Capacity { get; set; }
    public int UsedPorts { get; set; } = 0;

    [StringLength(50)]
    public string? Installation { get; set; } // aerial, underground, indoor

    [StringLength(20)]
    public string Status { get; set; } = "active";

    public string? Address { get; set; }
    public int? CoverageRadiusM { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    public DateTime? LastInspectionAt { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation
    public virtual Fdt? Fdt { get; set; }
    public virtual ICollection<FatPort> FatPorts { get; set; } = new List<FatPort>();
}

public class FatPort
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid FatId { get; set; }

    public int PortNumber { get; set; }

    [StringLength(20)]
    public string Status { get; set; } = "free"; // free, used, reserved, faulty

    public Guid? SubscriberId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation
    public virtual Fat? Fat { get; set; }
}
