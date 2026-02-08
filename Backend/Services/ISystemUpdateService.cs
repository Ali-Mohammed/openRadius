namespace Backend.Services;

/// <summary>
/// Service for checking and applying Docker-based system updates.
/// Only manages backend and frontend containers.
/// </summary>
public interface ISystemUpdateService
{
    /// <summary>
    /// Checks Docker Hub for the latest image versions and compares
    /// them with the currently running containers.
    /// </summary>
    Task<SystemUpdateStatusResponse> CheckForUpdatesAsync();

    /// <summary>
    /// Pulls the latest image and restarts a specific service container.
    /// </summary>
    /// <param name="serviceName">Either "backend" or "frontend"</param>
    Task<ServiceUpdateResult> UpdateServiceAsync(string serviceName);

    /// <summary>
    /// Pulls and restarts both backend and frontend services.
    /// </summary>
    Task<List<ServiceUpdateResult>> UpdateAllAsync();
}

// ── DTOs ────────────────────────────────────────────────────────────────────

public class SystemUpdateStatusResponse
{
    public List<ServiceUpdateInfo> Services { get; set; } = new();
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}

public class ServiceUpdateInfo
{
    public string ServiceName { get; set; } = string.Empty;
    public string ImageName { get; set; } = string.Empty;
    public string Tag { get; set; } = "latest";
    public string ContainerName { get; set; } = string.Empty;

    // Current (running) container info
    public string? CurrentDigest { get; set; }
    public DateTime? CurrentCreatedAt { get; set; }
    public string? CurrentStatus { get; set; }

    // Latest (Docker Hub) info
    public string? LatestDigest { get; set; }
    public DateTime? LatestPushedAt { get; set; }
    public long? LatestSizeBytes { get; set; }

    // Comparison
    public bool UpdateAvailable { get; set; }
    public string Status { get; set; } = "unknown"; // "up-to-date", "update-available", "container-not-found", "error"
    public string? ErrorMessage { get; set; }
}

public class ServiceUpdateResult
{
    public bool Success { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? OldDigest { get; set; }
    public string? NewDigest { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
