using System.Diagnostics;
using System.Globalization;

namespace Backend.Services;

/// <summary>
/// Monitors Docker containers and server resources by executing Docker CLI commands
/// against the mounted Docker socket. Also collects host-level stats via /proc.
/// </summary>
public class DockerMonitoringService : IDockerMonitoringService
{
    private readonly ILogger<DockerMonitoringService> _logger;
    private readonly string _procPath;

    public DockerMonitoringService(ILogger<DockerMonitoringService> logger, IConfiguration configuration)
    {
        _logger = logger;
        // In Docker containers, mount host /proc to /host/proc and set HOST_PROC_PATH=/host/proc
        _procPath = configuration["HOST_PROC_PATH"] ?? "/proc";
    }

    // ── Server Resources ────────────────────────────────────────────────────

    public async Task<ServerResourcesResponse> GetServerResourcesAsync()
    {
        var response = new ServerResourcesResponse { CollectedAt = DateTime.UtcNow };

        try
        {
            // Hostname
            var (_, hostname) = await RunCommand("hostname");
            response.Hostname = hostname.Trim();

            // OS & Kernel
            var (_, kernel) = await RunCommand("uname -r");
            response.Kernel = kernel.Trim();

            var (_, os) = await RunCommand("uname -s");
            response.Os = os.Trim();

            // Uptime
            var (_, uptime) = await RunCommand($"cat {_procPath}/uptime");
            if (!string.IsNullOrEmpty(uptime))
            {
                var uptimeSeconds = double.Parse(uptime.Split(' ')[0], CultureInfo.InvariantCulture);
                var ts = TimeSpan.FromSeconds(uptimeSeconds);
                response.Uptime = $"{(int)ts.TotalDays}d {ts.Hours}h {ts.Minutes}m";
            }

            // Load averages
            var (_, loadAvg) = await RunCommand($"cat {_procPath}/loadavg");
            if (!string.IsNullOrEmpty(loadAvg))
            {
                var parts = loadAvg.Trim().Split(' ');
                if (parts.Length >= 3)
                {
                    double.TryParse(parts[0], CultureInfo.InvariantCulture, out var l1);
                    double.TryParse(parts[1], CultureInfo.InvariantCulture, out var l5);
                    double.TryParse(parts[2], CultureInfo.InvariantCulture, out var l15);
                    response.LoadAverage1 = Math.Round(l1, 2);
                    response.LoadAverage5 = Math.Round(l5, 2);
                    response.LoadAverage15 = Math.Round(l15, 2);
                }
            }

            // CPU
            response.Cpu = await GetCpuInfoAsync();

            // Memory
            response.Memory = await GetMemoryInfoAsync();

            // Disk
            response.Disk = await GetDiskInfoAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting server resources");
        }

        return response;
    }

    // ── Docker Containers ───────────────────────────────────────────────────

    public async Task<List<ContainerInfoResponse>> GetContainersAsync(bool includeAll = true)
    {
        var containers = new List<ContainerInfoResponse>();

        try
        {
            var allFlag = includeAll ? "-a" : "";
            var format = "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.CreatedAt}}|{{.Ports}}";
            var (exitCode, output) = await RunDockerCommand($"ps {allFlag} --format \"{format}\" --no-trunc");

            if (exitCode != 0 || string.IsNullOrWhiteSpace(output))
            {
                _logger.LogWarning("docker ps returned exit code {ExitCode}: {Output}", exitCode, output);
                return containers;
            }

            var lines = output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                var parts = line.Split('|');
                if (parts.Length < 7) continue;

                containers.Add(new ContainerInfoResponse
                {
                    Id = parts[0],
                    ShortId = parts[0].Length > 12 ? parts[0][..12] : parts[0],
                    Name = parts[1],
                    Image = parts[2],
                    Status = parts[3],
                    State = parts[4],
                    Created = parts[5],
                    Ports = parts[6]
                });
            }

            // Fetch live stats for running containers
            var runningIds = containers
                .Where(c => c.State.Equals("running", StringComparison.OrdinalIgnoreCase))
                .Select(c => c.Id)
                .ToList();

            if (runningIds.Count != 0)
            {
                var statsMap = await GetBulkStatsAsync(runningIds);
                foreach (var container in containers)
                {
                    if (statsMap.TryGetValue(container.Id, out var stats))
                    {
                        container.Resources = stats;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing Docker containers");
        }

        return containers;
    }

    public async Task<ContainerStatsResponse?> GetContainerStatsAsync(string containerId)
    {
        try
        {
            var sanitized = SanitizeContainerId(containerId);
            var format = "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}";
            var (exitCode, output) = await RunDockerCommand($"stats {sanitized} --no-stream --format \"{format}\"");

            if (exitCode != 0 || string.IsNullOrWhiteSpace(output))
                return null;

            var parts = output.Trim().Split('|');
            if (parts.Length < 7) return null;

            double.TryParse(parts[3].Replace("%", ""), CultureInfo.InvariantCulture, out var memPct);
            int.TryParse(parts[6].Trim(), out var pids);

            return new ContainerStatsResponse
            {
                ContainerId = containerId,
                ContainerName = parts[0].TrimStart('/'),
                Resources = new ContainerResourceUsage
                {
                    CpuPercent = parts[1].Trim(),
                    MemoryUsage = parts[2].Trim(),
                    MemoryPercent = Math.Round(memPct, 2),
                    NetIO = parts[4].Trim(),
                    BlockIO = parts[5].Trim(),
                    Pids = pids
                },
                CollectedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting container stats for {ContainerId}", containerId);
            return null;
        }
    }

    // ── Container Lifecycle ─────────────────────────────────────────────────

    public async Task<ContainerActionResult> StartContainerAsync(string containerId)
    {
        return await PerformContainerAction(containerId, "start");
    }

    public async Task<ContainerActionResult> StopContainerAsync(string containerId)
    {
        return await PerformContainerAction(containerId, "stop");
    }

    public async Task<ContainerActionResult> RestartContainerAsync(string containerId)
    {
        return await PerformContainerAction(containerId, "restart");
    }

    // ── Container Logs ──────────────────────────────────────────────────────

    public async Task<ContainerLogsResponse> GetContainerLogsAsync(string containerId, int tail = 200, bool timestamps = true)
    {
        var response = new ContainerLogsResponse
        {
            ContainerId = containerId,
            CollectedAt = DateTime.UtcNow
        };

        try
        {
            var sanitized = SanitizeContainerId(containerId);
            var tsFlag = timestamps ? "--timestamps" : "";
            var (exitCode, output) = await RunDockerCommand(
                $"logs {sanitized} --tail {tail} {tsFlag}", timeoutSeconds: 15);

            if (exitCode != 0)
            {
                _logger.LogWarning("docker logs returned exit code {ExitCode} for {ContainerId}", exitCode, containerId);
            }

            // Get container name
            var (_, nameOutput) = await RunDockerCommand($"inspect --format \"{{{{.Name}}}}\" {sanitized}");
            response.ContainerName = nameOutput.Trim().TrimStart('/');

            response.Logs = output
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .ToList();
            response.LineCount = response.Logs.Count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting logs for container {ContainerId}", containerId);
            response.Logs.Add($"Error: {ex.Message}");
        }

        return response;
    }

    // ── Docker System Info ──────────────────────────────────────────────────

    public async Task<DockerSystemInfoResponse> GetDockerSystemInfoAsync()
    {
        var response = new DockerSystemInfoResponse { CollectedAt = DateTime.UtcNow };

        try
        {
            var format = "{{.ServerVersion}}|{{.NCPU}}|{{.MemTotal}}|{{.OperatingSystem}}|{{.Architecture}}|{{.KernelVersion}}|{{.Driver}}|{{.DockerRootDir}}|{{.Containers}}|{{.ContainersRunning}}|{{.ContainersStopped}}|{{.ContainersPaused}}|{{.Images}}";
            var (exitCode, output) = await RunDockerCommand($"system info --format \"{format}\"");

            if (exitCode != 0 || string.IsNullOrWhiteSpace(output))
            {
                _logger.LogWarning("docker system info failed: {Output}", output);
                return response;
            }

            var parts = output.Trim().Split('|');
            if (parts.Length >= 13)
            {
                response.ServerVersion = parts[0];
                int.TryParse(parts[1], out var cpus);
                response.Cpus = cpus;
                long.TryParse(parts[2], out var memTotal);
                response.TotalMemory = FormatBytes(memTotal);
                response.OperatingSystem = parts[3];
                response.Architecture = parts[4];
                response.KernelVersion = parts[5];
                response.StorageDriver = parts[6];
                response.DockerRootDir = parts[7];
                int.TryParse(parts[8], out var total);
                response.TotalContainers = total;
                int.TryParse(parts[9], out var running);
                response.RunningContainers = running;
                int.TryParse(parts[10], out var stopped);
                response.StoppedContainers = stopped;
                int.TryParse(parts[11], out var paused);
                response.PausedContainers = paused;
                int.TryParse(parts[12], out var images);
                response.Images = images;
            }

            // API version
            var (_, apiOutput) = await RunDockerCommand("version --format \"{{.Server.APIVersion}}\"");
            response.ApiVersion = apiOutput.Trim().Trim('"');

            response.Os = response.OperatingSystem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Docker system info");
        }

        return response;
    }

    // ── Private Helpers ─────────────────────────────────────────────────────

    private async Task<ContainerActionResult> PerformContainerAction(string containerId, string action)
    {
        var result = new ContainerActionResult
        {
            ContainerId = containerId,
            Action = action,
            PerformedAt = DateTime.UtcNow
        };

        try
        {
            var sanitized = SanitizeContainerId(containerId);
            _logger.LogInformation("Performing Docker {Action} on container {ContainerId}", action, sanitized);

            var (exitCode, output) = await RunDockerCommand($"{action} {sanitized}", timeoutSeconds: 60);

            result.Success = exitCode == 0;
            result.Message = result.Success
                ? $"Container {action} completed successfully"
                : $"Container {action} failed: {output.Trim()}";

            if (result.Success)
            {
                _logger.LogInformation("Docker {Action} succeeded for {ContainerId}", action, sanitized);
            }
            else
            {
                _logger.LogWarning("Docker {Action} failed for {ContainerId}: {Output}", action, sanitized, output);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing Docker {Action} on {ContainerId}", action, containerId);
            result.Success = false;
            result.Message = $"Error: {ex.Message}";
        }

        return result;
    }

    private async Task<Dictionary<string, ContainerResourceUsage>> GetBulkStatsAsync(List<string> containerIds)
    {
        var result = new Dictionary<string, ContainerResourceUsage>();

        try
        {
            var ids = string.Join(" ", containerIds.Select(SanitizeContainerId));
            var format = "{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}";
            var (exitCode, output) = await RunDockerCommand(
                $"stats {ids} --no-stream --format \"{format}\"", timeoutSeconds: 30);

            if (exitCode != 0 || string.IsNullOrWhiteSpace(output))
                return result;

            var lines = output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                var parts = line.Split('|');
                if (parts.Length < 7) continue;

                var id = parts[0].Trim();
                double.TryParse(parts[3].Replace("%", ""), CultureInfo.InvariantCulture, out var memPct);
                int.TryParse(parts[6].Trim(), out var pids);

                // Match by full or partial ID
                var matchedId = containerIds.FirstOrDefault(cid =>
                    cid.StartsWith(id, StringComparison.OrdinalIgnoreCase) ||
                    id.StartsWith(cid[..Math.Min(12, cid.Length)], StringComparison.OrdinalIgnoreCase));

                if (matchedId != null)
                {
                    result[matchedId] = new ContainerResourceUsage
                    {
                        CpuPercent = parts[1].Trim(),
                        MemoryUsage = parts[2].Trim(),
                        MemoryPercent = Math.Round(memPct, 2),
                        NetIO = parts[4].Trim(),
                        BlockIO = parts[5].Trim(),
                        Pids = pids
                    };
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting bulk container stats");
        }

        return result;
    }

    private async Task<CpuInfo> GetCpuInfoAsync()
    {
        var info = new CpuInfo();

        try
        {
            // Core count
            var (_, nproc) = await RunCommand("nproc");
            int.TryParse(nproc.Trim(), out var cores);
            info.Cores = cores;

            // CPU model
            var (_, cpuModel) = await RunCommand($"cat {_procPath}/cpuinfo | grep 'model name' | head -1 | cut -d: -f2");
            info.Model = cpuModel.Trim();

            // CPU usage from /proc/stat (instant snapshot)
            var (_, stat1) = await RunCommand($"head -1 {_procPath}/stat");
            await Task.Delay(250); // Brief delay for delta measurement
            var (_, stat2) = await RunCommand($"head -1 {_procPath}/stat");

            info.UsagePercent = CalculateCpuUsage(stat1, stat2);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error collecting CPU info");
        }

        return info;
    }

    private async Task<MemoryInfo> GetMemoryInfoAsync()
    {
        var info = new MemoryInfo();

        try
        {
            var (_, meminfo) = await RunCommand($"cat {_procPath}/meminfo");
            var lines = meminfo.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            var memMap = new Dictionary<string, long>();

            foreach (var line in lines)
            {
                var colonIdx = line.IndexOf(':');
                if (colonIdx <= 0) continue;
                var key = line[..colonIdx].Trim();
                var valStr = line[(colonIdx + 1)..].Trim().Replace(" kB", "").Trim();
                if (long.TryParse(valStr, out var valKb))
                {
                    memMap[key] = valKb * 1024; // Convert to bytes
                }
            }

            info.TotalBytes = memMap.GetValueOrDefault("MemTotal");
            info.AvailableBytes = memMap.GetValueOrDefault("MemAvailable");
            info.UsedBytes = info.TotalBytes - info.AvailableBytes;
            info.UsagePercent = info.TotalBytes > 0
                ? Math.Round((double)info.UsedBytes / info.TotalBytes * 100, 1)
                : 0;
            info.SwapTotalBytes = memMap.GetValueOrDefault("SwapTotal");
            info.SwapUsedBytes = info.SwapTotalBytes - memMap.GetValueOrDefault("SwapFree");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error collecting memory info");
        }

        return info;
    }

    private async Task<DiskInfo> GetDiskInfoAsync()
    {
        var info = new DiskInfo();

        try
        {
            var (_, dfOutput) = await RunCommand("df -B1 --output=source,target,size,used,avail,pcent -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -k");
            var lines = dfOutput.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries);

            long totalBytes = 0, usedBytes = 0, availBytes = 0;

            foreach (var line in lines.Skip(1)) // Skip header
            {
                var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 5) continue;

                // Skip pseudo-filesystems
                if (parts[0].StartsWith("tmpfs") || parts[0].StartsWith("devtmpfs") || parts[0] == "none")
                    continue;

                long.TryParse(parts[2], out var size);
                long.TryParse(parts[3], out var used);
                long.TryParse(parts[4], out var avail);

                var pctStr = parts.Length >= 6 ? parts[5].Replace("%", "") : "0";
                double.TryParse(pctStr, CultureInfo.InvariantCulture, out var pct);

                info.Partitions.Add(new DiskPartition
                {
                    Filesystem = parts[0],
                    MountPoint = parts[1],
                    TotalBytes = size,
                    UsedBytes = used,
                    AvailableBytes = avail,
                    UsagePercent = Math.Round(pct, 1)
                });

                totalBytes += size;
                usedBytes += used;
                availBytes += avail;
            }

            info.TotalBytes = totalBytes;
            info.UsedBytes = usedBytes;
            info.AvailableBytes = availBytes;
            info.UsagePercent = totalBytes > 0
                ? Math.Round((double)usedBytes / totalBytes * 100, 1)
                : 0;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error collecting disk info");
        }

        return info;
    }

    private static double CalculateCpuUsage(string stat1, string stat2)
    {
        try
        {
            var values1 = ParseCpuStat(stat1);
            var values2 = ParseCpuStat(stat2);

            if (values1 == null || values2 == null) return 0;

            var idle1 = values1[3] + values1[4]; // idle + iowait
            var idle2 = values2[3] + values2[4];
            var total1 = values1.Sum();
            var total2 = values2.Sum();

            var totalDelta = total2 - total1;
            var idleDelta = idle2 - idle1;

            return totalDelta > 0
                ? Math.Round((1.0 - (double)idleDelta / totalDelta) * 100, 1)
                : 0;
        }
        catch
        {
            return 0;
        }
    }

    private static long[]? ParseCpuStat(string stat)
    {
        var parts = stat.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 5 || parts[0] != "cpu") return null;
        return parts.Skip(1).Take(7)
            .Select(p => long.TryParse(p, out var v) ? v : 0)
            .ToArray();
    }

    private static string FormatBytes(long bytes)
    {
        string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
        var order = 0;
        double value = bytes;
        while (value >= 1024 && order < suffixes.Length - 1)
        {
            order++;
            value /= 1024;
        }
        return $"{value:F1} {suffixes[order]}";
    }

    /// <summary>
    /// Sanitizes container IDs to prevent shell injection.
    /// Only allows alphanumeric characters, hyphens, underscores, and dots.
    /// </summary>
    private static string SanitizeContainerId(string containerId)
    {
        return new string(containerId.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == '.').ToArray());
    }

    // ── Shell execution ─────────────────────────────────────────────────────

    private static async Task<(int ExitCode, string Output)> RunDockerCommand(
        string args, int timeoutSeconds = 30)
    {
        return await RunCommand($"docker {args}", timeoutSeconds);
    }

    private static async Task<(int ExitCode, string Output)> RunCommand(
        string command, int timeoutSeconds = 30)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "/bin/sh",
                Arguments = $"-c \"{command.Replace("\"", "\\\"")}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            if (process == null)
                return (-1, "Failed to start process");

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();

            var completed = process.WaitForExit(timeoutSeconds * 1000);
            if (!completed)
            {
                process.Kill(entireProcessTree: true);
                return (-1, "Command timed out");
            }

            var output = await outputTask;
            var error = await errorTask;

            return (process.ExitCode, string.IsNullOrEmpty(output) ? error : output);
        }
        catch (Exception ex)
        {
            return (-1, $"Execution error: {ex.Message}");
        }
    }
}
