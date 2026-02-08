using System.Diagnostics;
using System.Text.Json;

namespace Backend.Services;

/// <summary>
/// Checks Docker Hub for the latest image versions, compares with running containers,
/// and orchestrates pull + restart for backend and frontend services only.
/// </summary>
public class SystemUpdateService : ISystemUpdateService
{
    private readonly ILogger<SystemUpdateService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    // Default image/container configuration (overridable via appsettings)
    private const string DefaultBackendImage = "alimohammed/openradius-backend";
    private const string DefaultFrontendImage = "alimohammed/openradius-frontend";
    private const string DefaultBackendContainer = "openradius-backend";
    private const string DefaultFrontendContainer = "openradius-frontend";
    private const string DefaultTag = "latest";

    public SystemUpdateService(
        ILogger<SystemUpdateService> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    public async Task<SystemUpdateStatusResponse> CheckForUpdatesAsync()
    {
        _logger.LogInformation("Checking for system updates...");

        var services = GetServiceConfigs();
        var result = new SystemUpdateStatusResponse();

        foreach (var svc in services)
        {
            var info = new ServiceUpdateInfo
            {
                ServiceName = svc.Name,
                ImageName = svc.Image,
                Tag = svc.Tag,
                ContainerName = svc.Container
            };

            try
            {
                // Check current running container
                await PopulateCurrentContainerInfo(info);

                // Check latest on Docker Hub
                await PopulateLatestHubInfo(info);

                // Compare digests
                if (info.CurrentDigest != null && info.LatestDigest != null)
                {
                    // Normalize digests for comparison (remove "sha256:" prefix if present)
                    var currentNorm = NormalizeDigest(info.CurrentDigest);
                    var latestNorm = NormalizeDigest(info.LatestDigest);

                    info.UpdateAvailable = !string.Equals(currentNorm, latestNorm, StringComparison.OrdinalIgnoreCase);
                    info.Status = info.UpdateAvailable ? "update-available" : "up-to-date";
                }
                else if (info.CurrentDigest == null && info.CurrentStatus == "not-found")
                {
                    info.Status = "container-not-found";
                }
                else
                {
                    info.Status = info.LatestDigest != null ? "update-available" : "unknown";
                    info.UpdateAvailable = info.LatestDigest != null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking updates for {Service}", svc.Name);
                info.Status = "error";
                info.ErrorMessage = ex.Message;
            }

            result.Services.Add(info);
        }

        result.CheckedAt = DateTime.UtcNow;
        return result;
    }

    public async Task<ServiceUpdateResult> UpdateServiceAsync(string serviceName)
    {
        var services = GetServiceConfigs();
        var svc = services.FirstOrDefault(s =>
            s.Name.Equals(serviceName, StringComparison.OrdinalIgnoreCase));

        if (svc == null)
        {
            return new ServiceUpdateResult
            {
                Success = false,
                ServiceName = serviceName,
                Message = $"Unknown service: {serviceName}. Valid services: backend, frontend"
            };
        }

        return await PullAndRestartService(svc);
    }

    public async Task<List<ServiceUpdateResult>> UpdateAllAsync()
    {
        var services = GetServiceConfigs();
        var results = new List<ServiceUpdateResult>();

        foreach (var svc in services)
        {
            var result = await PullAndRestartService(svc);
            results.Add(result);
        }

        return results;
    }

    public async Task<List<ServiceUpdateResult>> UpdateSelectedAsync(List<string> serviceNames)
    {
        var allConfigs = GetServiceConfigs();
        var results = new List<ServiceUpdateResult>();

        // Sort so backend is always updated LAST (it restarts itself)
        var orderedNames = serviceNames
            .OrderBy(n => n.Equals("backend", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
            .ToList();

        foreach (var name in orderedNames)
        {
            var svc = allConfigs.FirstOrDefault(s =>
                s.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

            if (svc == null)
            {
                results.Add(new ServiceUpdateResult
                {
                    Success = false,
                    ServiceName = name,
                    Message = $"Unknown service: {name}. Valid services: backend, frontend"
                });
                continue;
            }

            _logger.LogInformation("Updating selected service: {Service}", name);
            var result = await PullAndRestartService(svc);
            results.Add(result);
        }

        return results;
    }

    public async Task<PreUpdateCheckResult> RunPreUpdateChecksAsync(List<string> serviceNames)
    {
        var result = new PreUpdateCheckResult { Ready = true };

        // Check 1: Docker socket available
        var (dockerExit, dockerOutput) = await RunDockerCommand("info --format \"{{.ServerVersion}}\"");
        result.Checks.Add(new PreUpdateCheckItem
        {
            Name = "Docker Socket",
            Passed = dockerExit == 0,
            Message = dockerExit == 0
                ? $"Docker daemon reachable (v{dockerOutput.Trim().Trim('"')})"
                : "Cannot connect to Docker daemon. Is the socket mounted?"
        });
        if (dockerExit != 0) result.Ready = false;

        // Check 2: Docker Compose available
        var (composeExit, composeOutput) = await RunShellCommand("docker compose version --short");
        result.Checks.Add(new PreUpdateCheckItem
        {
            Name = "Docker Compose",
            Passed = composeExit == 0,
            Message = composeExit == 0
                ? $"Docker Compose available (v{composeOutput.Trim()})"
                : "Docker Compose not available. Container restart may require manual intervention."
        });

        // Check 3: Compose file accessible
        var composePath = _configuration["SystemUpdate:DockerComposePath"];
        if (string.IsNullOrEmpty(composePath))
        {
            var commonPaths = new[]
            {
                "/opt/openradius/docker-compose.prod.yml",
                "/app/docker-compose.prod.yml",
                "/app/docker-compose.yml",
                "/opt/openradius/docker-compose.yml"
            };
            composePath = commonPaths.FirstOrDefault(File.Exists);
        }
        var composeFileExists = !string.IsNullOrEmpty(composePath) && File.Exists(composePath);
        result.Checks.Add(new PreUpdateCheckItem
        {
            Name = "Compose File",
            Passed = composeFileExists,
            Message = composeFileExists
                ? $"Compose file found: {composePath}"
                : "No compose file found. Services will be stopped but may not auto-restart."
        });
        if (!composeFileExists) result.Warnings.Add("Without a compose file, containers cannot be automatically recreated after update.");

        // Check 4: Docker Hub reachable
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            var hubResponse = await client.GetAsync("https://registry-1.docker.io/v2/");
            // Docker Registry returns 200 or 401 (auth required) — both mean it's reachable
            var isReachable = hubResponse.IsSuccessStatusCode
                || hubResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized;
            result.Checks.Add(new PreUpdateCheckItem
            {
                Name = "Docker Hub",
                Passed = isReachable,
                Message = isReachable
                    ? "Docker Hub is reachable"
                    : $"Docker Hub returned {hubResponse.StatusCode}"
            });
            if (!isReachable) result.Ready = false;
        }
        catch (Exception ex)
        {
            result.Checks.Add(new PreUpdateCheckItem
            {
                Name = "Docker Hub",
                Passed = false,
                Message = $"Cannot reach Docker Hub: {ex.Message}"
            });
            result.Ready = false;
        }

        // Check 5: Containers running for selected services
        var allConfigs = GetServiceConfigs();
        foreach (var name in serviceNames)
        {
            var svc = allConfigs.FirstOrDefault(s =>
                s.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (svc == null) continue;

            var (inspExit, _) = await RunDockerCommand($"inspect {svc.Container}");
            result.Checks.Add(new PreUpdateCheckItem
            {
                Name = $"Container: {svc.Name}",
                Passed = inspExit == 0,
                Message = inspExit == 0
                    ? $"Container '{svc.Container}' is accessible"
                    : $"Container '{svc.Container}' not found"
            });
            if (inspExit != 0) result.Warnings.Add($"Container '{svc.Container}' was not found. A fresh deployment may be needed.");
        }

        // Warnings
        if (serviceNames.Any(s => s.Equals("backend", StringComparison.OrdinalIgnoreCase)))
        {
            result.Warnings.Add("Updating the backend will cause a brief API outage. Active user sessions may be interrupted.");
        }

        return result;
    }

    // ── Docker Hub API ──────────────────────────────────────────────────────

    private async Task PopulateLatestHubInfo(ServiceUpdateInfo info)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);

            // Docker Hub v2 tags API (public, no auth needed for public repos)
            var url = $"https://hub.docker.com/v2/repositories/{info.ImageName}/tags/{info.Tag}";
            _logger.LogDebug("Querying Docker Hub: {Url}", url);

            var response = await client.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Docker Hub returned {Status} for {Image}:{Tag}",
                    response.StatusCode, info.ImageName, info.Tag);
                return;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("digest", out var digest))
                info.LatestDigest = digest.GetString();

            if (root.TryGetProperty("last_updated", out var lastUpdated))
            {
                if (DateTime.TryParse(lastUpdated.GetString(), out var dt))
                    info.LatestPushedAt = dt.ToUniversalTime();
            }

            if (root.TryGetProperty("full_size", out var size))
                info.LatestSizeBytes = size.GetInt64();

            _logger.LogInformation(
                "Docker Hub latest for {Image}:{Tag} → digest={Digest}, pushed={Pushed}",
                info.ImageName, info.Tag,
                info.LatestDigest != null ? info.LatestDigest[..Math.Min(20, info.LatestDigest.Length)] : "null",
                info.LatestPushedAt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to query Docker Hub for {Image}:{Tag}", info.ImageName, info.Tag);
        }
    }

    // ── Docker CLI helpers ──────────────────────────────────────────────────

    private async Task PopulateCurrentContainerInfo(ServiceUpdateInfo info)
    {
        try
        {
            // Get container status and image digest
            var (exitCode, output) = await RunDockerCommand(
                $"inspect --format \"{{{{.State.Status}}}} {{{{.Image}}}} {{{{.Created}}}}\" {info.ContainerName}");

            if (exitCode != 0)
            {
                _logger.LogWarning("Container {Container} not found or docker not available", info.ContainerName);
                info.CurrentStatus = "not-found";
                return;
            }

            var parts = output.Trim().Split(' ', 3);
            if (parts.Length >= 1)
                info.CurrentStatus = parts[0]; // running, exited, etc.
            if (parts.Length >= 2)
                info.CurrentDigest = parts[1]; // sha256:xxx
            if (parts.Length >= 3 && DateTime.TryParse(parts[2], out var created))
                info.CurrentCreatedAt = created.ToUniversalTime();

            // Also get the RepoDigests to compare with Hub digest
            var (exitCode2, output2) = await RunDockerCommand(
                $"inspect --format \"{{{{index .RepoDigests 0}}}}\" {info.ImageName}:{info.Tag}");

            if (exitCode2 == 0 && !string.IsNullOrWhiteSpace(output2))
            {
                // RepoDigests format: "alimohammed/openradius-backend@sha256:abc123..."
                var repoDigest = output2.Trim().Trim('"');
                var atIndex = repoDigest.IndexOf('@');
                if (atIndex > 0)
                    info.CurrentDigest = repoDigest[(atIndex + 1)..];
            }

            _logger.LogInformation(
                "Current container {Container}: status={Status}, digest={Digest}",
                info.ContainerName, info.CurrentStatus,
                info.CurrentDigest?[..Math.Min(20, info.CurrentDigest?.Length ?? 0)] ?? "null");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to inspect container {Container}", info.ContainerName);
            info.CurrentStatus = "error";
            info.ErrorMessage = ex.Message;
        }
    }

    private async Task<ServiceUpdateResult> PullAndRestartService(ServiceConfig svc)
    {
        _logger.LogInformation("Updating service: {Service} ({Image}:{Tag})", svc.Name, svc.Image, svc.Tag);

        var result = new ServiceUpdateResult { ServiceName = svc.Name };

        try
        {
            // Step 1: Get current digest before update
            var (_, oldDigestOutput) = await RunDockerCommand(
                $"inspect --format \"{{{{index .RepoDigests 0}}}}\" {svc.Image}:{svc.Tag}");
            result.OldDigest = ExtractDigest(oldDigestOutput);

            // Step 2: Pull the latest image
            _logger.LogInformation("Pulling {Image}:{Tag}...", svc.Image, svc.Tag);
            var (pullExit, pullOutput) = await RunDockerCommand($"pull {svc.Image}:{svc.Tag}", timeoutSeconds: 300);

            if (pullExit != 0)
            {
                result.Success = false;
                result.Message = $"Failed to pull image: {pullOutput}";
                _logger.LogError("Pull failed for {Image}:{Tag}: {Output}", svc.Image, svc.Tag, pullOutput);
                return result;
            }

            _logger.LogInformation("Pull successful for {Image}:{Tag}", svc.Image, svc.Tag);

            // Step 3: Get new digest after pull
            var (_, newDigestOutput) = await RunDockerCommand(
                $"inspect --format \"{{{{index .RepoDigests 0}}}}\" {svc.Image}:{svc.Tag}");
            result.NewDigest = ExtractDigest(newDigestOutput);

            // Step 4: Restart the container
            // For backend (self-update): schedule a delayed restart so the API can respond first
            var isSelfUpdate = svc.Name.Equals("backend", StringComparison.OrdinalIgnoreCase);

            if (isSelfUpdate)
            {
                var scheduled = await ScheduleDelayedRestart(svc);
                if (scheduled)
                {
                    result.Success = true;
                    result.Message = $"Successfully pulled new image for {svc.Name}. Container will restart in a few seconds.";
                    _logger.LogInformation("Backend self-update: delayed restart scheduled for {Service}", svc.Name);
                }
                else
                {
                    result.Success = true;
                    result.Message = $"New image pulled for {svc.Name}. Please restart the backend container manually.";
                    _logger.LogWarning("Backend self-update: could not schedule restart for {Service}", svc.Name);
                }
            }
            else
            {
                // For other services: restart immediately
                var restarted = await TryRestartWithCompose(svc);
                if (!restarted)
                    restarted = await TryRestartWithDocker(svc);

                if (restarted)
                {
                    result.Success = true;
                    result.Message = $"Successfully updated {svc.Name}. New image pulled and container restarted.";
                    _logger.LogInformation("Service {Service} updated successfully", svc.Name);
                }
                else
                {
                    // Image pulled but container not restarted — still partially successful
                    result.Success = true;
                    result.Message = $"New image pulled for {svc.Name}. Container restart may require manual intervention.";
                    _logger.LogWarning("Image pulled for {Service} but automatic restart not available", svc.Name);
                }
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = $"Update failed: {ex.Message}";
            _logger.LogError(ex, "Failed to update service {Service}", svc.Name);
        }

        result.UpdatedAt = DateTime.UtcNow;
        return result;
    }

    /// <summary>
    /// Schedules a delayed restart for the backend container (self-update).
    /// Spawns a separate short-lived Docker container with socket access that waits
    /// a few seconds then runs docker compose to recreate the backend.
    /// This container is independent of the backend being restarted.
    /// </summary>
    private async Task<bool> ScheduleDelayedRestart(ServiceConfig svc)
    {
        var composePath = FindComposePath();
        if (composePath == null)
        {
            _logger.LogWarning("No compose file found for delayed restart");
            return false;
        }

        var composeDir = Path.GetDirectoryName(composePath)!;
        var composeFile = Path.GetFileName(composePath);

        // Spawn a separate helper container that:
        // 1. Has access to the Docker socket (to run docker compose)
        // 2. Has access to the compose file directory (including .env)
        // 3. Sleeps 5 seconds (so the API can respond first)
        // 4. Runs docker compose up to recreate the backend with the new image
        // 5. Removes itself when done (--rm)
        var envFileArg = File.Exists(Path.Combine(composeDir, ".env"))
            ? $"--env-file .env "
            : "";
        var command = $"docker run -d --rm " +
            $"--name openradius-backend-updater " +
            $"-v /var/run/docker.sock:/var/run/docker.sock " +
            $"-v \"{composeDir}\":\"{composeDir}\":ro " +
            $"-w \"{composeDir}\" " +
            $"docker:cli sh -c '" +
            $"sleep 5 && docker compose -f \"{composeFile}\" {envFileArg}up -d --no-deps --pull never {svc.ComposeService}" +
            $"'";

        _logger.LogInformation("Scheduling backend restart via helper container");
        var (exitCode, output) = await RunShellCommand(command, timeoutSeconds: 15);

        if (exitCode == 0)
        {
            _logger.LogInformation("Helper container launched for {Service} restart (5s delay). Container ID: {Id}",
                svc.Name, output.Trim());
            return true;
        }

        _logger.LogWarning("Failed to launch helper container: exit={ExitCode}, output={Output}", exitCode, output);
        return false;
    }

    private string? FindComposePath()
    {
        var composePath = _configuration["SystemUpdate:DockerComposePath"];

        if (string.IsNullOrEmpty(composePath))
        {
            var commonPaths = new[]
            {
                "/opt/openradius/docker-compose.prod.yml",
                "/app/docker-compose.prod.yml",
                "/app/docker-compose.yml",
                "/opt/openradius/docker-compose.yml"
            };

            composePath = commonPaths.FirstOrDefault(File.Exists);
        }

        return !string.IsNullOrEmpty(composePath) && File.Exists(composePath) ? composePath : null;
    }

    private async Task<bool> TryRestartWithCompose(ServiceConfig svc)
    {
        var composePath = FindComposePath();

        if (composePath == null)
        {
            _logger.LogDebug("No docker-compose file found, skipping compose restart");
            return false;
        }

        var composeDir = Path.GetDirectoryName(composePath)!;
        var composeFile = Path.GetFileName(composePath);

        var (exitCode, output) = await RunShellCommand(
            $"cd \"{composeDir}\" && docker compose -f \"{composeFile}\" up -d --no-deps {svc.ComposeService}",
            timeoutSeconds: 120);

        if (exitCode == 0)
        {
            _logger.LogInformation("Compose restart successful for {Service}", svc.Name);
            return true;
        }

        _logger.LogWarning("Compose restart failed for {Service}: {Output}", svc.Name, output);
        return false;
    }

    private async Task<bool> TryRestartWithDocker(ServiceConfig svc)
    {
        // Stop and remove the old container, then start a new one
        // First, get the current container's full config to recreate it
        var (inspectExit, inspectOutput) = await RunDockerCommand(
            $"inspect {svc.Container}");

        if (inspectExit != 0)
        {
            _logger.LogWarning("Cannot inspect container {Container} for restart", svc.Container);
            return false;
        }

        // Simple restart: stop, remove, and let the orchestrator recreate
        // Or use docker restart if the image is already updated
        var (stopExit, _) = await RunDockerCommand($"stop {svc.Container}", timeoutSeconds: 30);
        if (stopExit != 0)
        {
            _logger.LogWarning("Failed to stop container {Container}", svc.Container);
            return false;
        }

        var (rmExit, _) = await RunDockerCommand($"rm {svc.Container}", timeoutSeconds: 10);
        if (rmExit != 0)
        {
            _logger.LogWarning("Failed to remove container {Container}, trying restart", svc.Container);
            await RunDockerCommand($"start {svc.Container}", timeoutSeconds: 30);
            return true;
        }

        // Try to recreate from inspect data (simplified — uses basic docker run)
        // In production, this should be managed by compose or an orchestrator
        _logger.LogInformation(
            "Container {Container} stopped and removed. Image updated. Container needs to be recreated by orchestrator.",
            svc.Container);

        return false; // Container removed but not recreated — needs orchestrator
    }

    // ── Shell execution helpers ─────────────────────────────────────────────

    private static async Task<(int ExitCode, string Output)> RunDockerCommand(
        string args, int timeoutSeconds = 30)
    {
        return await RunShellCommand($"docker {args}", timeoutSeconds);
    }

    private static async Task<(int ExitCode, string Output)> RunShellCommand(
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

    // ── Configuration helpers ───────────────────────────────────────────────

    private List<ServiceConfig> GetServiceConfigs()
    {
        return new List<ServiceConfig>
        {
            new()
            {
                Name = "backend",
                Image = _configuration["SystemUpdate:Backend:Image"] ?? DefaultBackendImage,
                Tag = _configuration["SystemUpdate:Backend:Tag"] ?? DefaultTag,
                Container = _configuration["SystemUpdate:Backend:ContainerName"] ?? DefaultBackendContainer,
                ComposeService = _configuration["SystemUpdate:Backend:ComposeService"] ?? "backend"
            },
            new()
            {
                Name = "frontend",
                Image = _configuration["SystemUpdate:Frontend:Image"] ?? DefaultFrontendImage,
                Tag = _configuration["SystemUpdate:Frontend:Tag"] ?? DefaultTag,
                Container = _configuration["SystemUpdate:Frontend:ContainerName"] ?? DefaultFrontendContainer,
                ComposeService = _configuration["SystemUpdate:Frontend:ComposeService"] ?? "frontend"
            }
        };
    }

    private static string NormalizeDigest(string? digest)
    {
        if (string.IsNullOrEmpty(digest)) return string.Empty;
        // Remove "sha256:" prefix if present
        return digest.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase)
            ? digest[7..]
            : digest;
    }

    private static string? ExtractDigest(string? output)
    {
        if (string.IsNullOrEmpty(output)) return null;
        var trimmed = output.Trim().Trim('"');
        var atIndex = trimmed.IndexOf('@');
        return atIndex > 0 ? trimmed[(atIndex + 1)..] : trimmed;
    }

    private class ServiceConfig
    {
        public string Name { get; set; } = string.Empty;
        public string Image { get; set; } = string.Empty;
        public string Tag { get; set; } = "latest";
        public string Container { get; set; } = string.Empty;
        public string ComposeService { get; set; } = string.Empty;
    }
}
