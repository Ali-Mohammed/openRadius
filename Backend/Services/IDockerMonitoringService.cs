namespace Backend.Services;

/// <summary>
/// Service for monitoring Docker containers and server resources.
/// Provides real-time container stats, lifecycle management, and log retrieval.
/// </summary>
public interface IDockerMonitoringService
{
    /// <summary>
    /// Gets host server resource statistics (CPU, memory, disk, uptime).
    /// </summary>
    Task<ServerResourcesResponse> GetServerResourcesAsync();

    /// <summary>
    /// Gets a list of all Docker containers with their current status and resource usage.
    /// </summary>
    Task<List<ContainerInfoResponse>> GetContainersAsync(bool includeAll = true);

    /// <summary>
    /// Gets detailed stats for a specific container.
    /// </summary>
    Task<ContainerStatsResponse?> GetContainerStatsAsync(string containerId);

    /// <summary>
    /// Starts a stopped container.
    /// </summary>
    Task<ContainerActionResult> StartContainerAsync(string containerId);

    /// <summary>
    /// Stops a running container.
    /// </summary>
    Task<ContainerActionResult> StopContainerAsync(string containerId);

    /// <summary>
    /// Restarts a container.
    /// </summary>
    Task<ContainerActionResult> RestartContainerAsync(string containerId);

    /// <summary>
    /// Gets the logs for a specific container.
    /// </summary>
    Task<ContainerLogsResponse> GetContainerLogsAsync(string containerId, int tail = 200, bool timestamps = true);

    /// <summary>
    /// Gets Docker system-wide information (version, storage, etc.).
    /// </summary>
    Task<DockerSystemInfoResponse> GetDockerSystemInfoAsync();
}

// ── Response DTOs ─────────────────────────────────────────────────────────

public class ServerResourcesResponse
{
    public CpuInfo Cpu { get; set; } = new();
    public MemoryInfo Memory { get; set; } = new();
    public DiskInfo Disk { get; set; } = new();
    public string Hostname { get; set; } = string.Empty;
    public string Os { get; set; } = string.Empty;
    public string Kernel { get; set; } = string.Empty;
    public string Uptime { get; set; } = string.Empty;
    public double LoadAverage1 { get; set; }
    public double LoadAverage5 { get; set; }
    public double LoadAverage15 { get; set; }
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

public class CpuInfo
{
    public double UsagePercent { get; set; }
    public int Cores { get; set; }
    public string Model { get; set; } = string.Empty;
}

public class MemoryInfo
{
    public long TotalBytes { get; set; }
    public long UsedBytes { get; set; }
    public long AvailableBytes { get; set; }
    public double UsagePercent { get; set; }
    public long SwapTotalBytes { get; set; }
    public long SwapUsedBytes { get; set; }
}

public class DiskInfo
{
    public List<DiskPartition> Partitions { get; set; } = new();
    public long TotalBytes { get; set; }
    public long UsedBytes { get; set; }
    public long AvailableBytes { get; set; }
    public double UsagePercent { get; set; }
}

public class DiskPartition
{
    public string Filesystem { get; set; } = string.Empty;
    public string MountPoint { get; set; } = string.Empty;
    public long TotalBytes { get; set; }
    public long UsedBytes { get; set; }
    public long AvailableBytes { get; set; }
    public double UsagePercent { get; set; }
}

public class ContainerInfoResponse
{
    public string Id { get; set; } = string.Empty;
    public string ShortId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Created { get; set; } = string.Empty;
    public string Ports { get; set; } = string.Empty;
    public ContainerResourceUsage Resources { get; set; } = new();
}

public class ContainerResourceUsage
{
    public string CpuPercent { get; set; } = "0.00%";
    public string MemoryUsage { get; set; } = "0B / 0B";
    public double MemoryPercent { get; set; }
    public string NetIO { get; set; } = "0B / 0B";
    public string BlockIO { get; set; } = "0B / 0B";
    public int Pids { get; set; }
}

public class ContainerStatsResponse
{
    public string ContainerId { get; set; } = string.Empty;
    public string ContainerName { get; set; } = string.Empty;
    public ContainerResourceUsage Resources { get; set; } = new();
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

public class ContainerActionResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string ContainerId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
}

public class ContainerLogsResponse
{
    public string ContainerId { get; set; } = string.Empty;
    public string ContainerName { get; set; } = string.Empty;
    public List<string> Logs { get; set; } = new();
    public int LineCount { get; set; }
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

public class DockerSystemInfoResponse
{
    public string ServerVersion { get; set; } = string.Empty;
    public string ApiVersion { get; set; } = string.Empty;
    public string Os { get; set; } = string.Empty;
    public string Architecture { get; set; } = string.Empty;
    public int TotalContainers { get; set; }
    public int RunningContainers { get; set; }
    public int StoppedContainers { get; set; }
    public int PausedContainers { get; set; }
    public int Images { get; set; }
    public string StorageDriver { get; set; } = string.Empty;
    public string DockerRootDir { get; set; } = string.Empty;
    public string TotalMemory { get; set; } = string.Empty;
    public int Cpus { get; set; }
    public string KernelVersion { get; set; } = string.Empty;
    public string OperatingSystem { get; set; } = string.Empty;
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}
