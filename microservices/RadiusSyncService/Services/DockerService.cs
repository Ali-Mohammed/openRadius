using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace RadiusSyncService.Services;

/// <summary>
/// Enterprise-grade Docker management service.
/// Handles detection, installation, and management of Docker and Docker Compose.
/// </summary>
public class DockerService
{
    private readonly ILogger<DockerService> _logger;
    private DockerStatus _cachedStatus;
    private DateTime _lastCheck = DateTime.MinValue;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromSeconds(30);
    private DockerClient? _dockerClient;

    public DockerService(ILogger<DockerService> logger)
    {
        _logger = logger;
        _cachedStatus = new DockerStatus();
        InitializeDockerClient();
    }

    private void InitializeDockerClient()
    {
        try
        {
            // Create Docker client based on platform
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                _dockerClient = new DockerClientConfiguration(new Uri("npipe://./pipe/docker_engine")).CreateClient();
            }
            else
            {
                // macOS and Linux use Unix socket
                _dockerClient = new DockerClientConfiguration(new Uri("unix:///var/run/docker.sock")).CreateClient();
            }
            _logger.LogInformation("Docker client initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to initialize Docker client");
        }
    }

    /// <summary>
    /// Gets the current Docker installation status.
    /// </summary>
    public async Task<DockerStatus> GetStatusAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && DateTime.UtcNow - _lastCheck < _cacheDuration)
        {
            return _cachedStatus;
        }

        _logger.LogInformation("Checking Docker installation status...");

        var status = new DockerStatus
        {
            Platform = GetPlatform(),
            CheckedAt = DateTime.UtcNow
        };

        if (_dockerClient == null)
        {
            _logger.LogWarning("Docker client not initialized");
            status.DockerInstalled = CheckDockerBinaryExists();
            _cachedStatus = status;
            _lastCheck = DateTime.UtcNow;
            return status;
        }

        try
        {
            // Try to get Docker version using API
            var versionResponse = await _dockerClient.System.GetVersionAsync();
            status.DockerInstalled = true;
            status.DockerRunning = true;
            status.DockerVersion = versionResponse.Version;
            
            _logger.LogInformation("Docker version: {Version}", status.DockerVersion);

            // Get Docker system info
            var systemInfo = await _dockerClient.System.GetSystemInfoAsync();
            status.DockerInfo = new DockerInfo
            {
                ServerVersion = systemInfo.ServerVersion,
                OperatingSystem = systemInfo.OperatingSystem,
                Architecture = systemInfo.Architecture,
                Containers = systemInfo.Containers,
                ContainersRunning = systemInfo.ContainersRunning,
                ContainersPaused = systemInfo.ContainersPaused,
                ContainersStopped = systemInfo.ContainersStopped,
                Images = systemInfo.Images
            };

            // Check Docker Compose
            status.DockerComposeInstalled = true; // Docker Desktop includes Compose
            status.DockerComposeV2 = true;
            
            // Get running containers
            var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters
            {
                All = false
            });
            status.RunningContainers = containers.Select(c => new ContainerInfo
            {
                Id = c.ID,
                Name = c.Names?.FirstOrDefault()?.TrimStart('/') ?? "unknown",
                Image = c.Image,
                State = c.State,
                Status = c.Status,
                Created = DateTimeOffset.FromUnixTimeSeconds(c.Created).DateTime
            }).ToList();

            // Get all containers
            var allContainers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters
            {
                All = true
            });
            status.AllContainers = allContainers.Select(c => new ContainerInfo
            {
                Id = c.ID,
                Name = c.Names?.FirstOrDefault()?.TrimStart('/') ?? "unknown",
                Image = c.Image,
                State = c.State,
                Status = c.Status,
                Created = DateTimeOffset.FromUnixTimeSeconds(c.Created).DateTime
            }).ToList();

            // Get images
            var images = await _dockerClient.Images.ListImagesAsync(new ImagesListParameters
            {
                All = false
            });
            status.Images = images.Select(img => new ImageInfo
            {
                Id = img.ID,
                Tags = img.RepoTags?.ToList() ?? new List<string>(),
                Size = img.Size,
                Created = DateTimeOffset.FromUnixTimeSeconds(img.Created).DateTime
            }).ToList();

            // Get networks
            var networks = await _dockerClient.Networks.ListNetworksAsync();
            status.Networks = networks.Select(n => new NetworkInfo
            {
                Id = n.ID,
                Name = n.Name,
                Driver = n.Driver,
                Scope = n.Scope
            }).ToList();

            // Get volumes
            var volumes = await _dockerClient.Volumes.ListAsync();
            status.Volumes = volumes.Volumes?.Select(v => new VolumeInfo
            {
                Name = v.Name,
                Driver = v.Driver,
                Mountpoint = v.Mountpoint
            }).ToList() ?? new List<VolumeInfo>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to connect to Docker daemon via API");
            
            // Fallback: check if Docker binary exists
            status.DockerInstalled = CheckDockerBinaryExists();
            status.DockerRunning = false;
            
            if (status.DockerInstalled)
            {
                status.DockerVersion = GetDockerVersionFromPlist() ?? "Installed (not running)";
                status.DockerComposeInstalled = true;
                status.DockerComposeV2 = true;
            }
        }

        _cachedStatus = status;
        _lastCheck = DateTime.UtcNow;

        return status;
    }

    private bool CheckDockerBinaryExists()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            return File.Exists("/Applications/Docker.app/Contents/Resources/bin/docker");
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            return File.Exists("/usr/bin/docker") || File.Exists("/usr/local/bin/docker");
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            return File.Exists(Path.Combine(programFiles, "Docker", "Docker", "resources", "bin", "docker.exe"));
        }
        return false;
    }

    /// <summary>
    /// Gets installation instructions based on the current platform.
    /// </summary>
    public DockerInstallationGuide GetInstallationGuide()
    {
        var platform = GetPlatform();
        
        return platform switch
        {
            "macOS" => new DockerInstallationGuide
            {
                Platform = platform,
                RecommendedMethod = "Docker Desktop",
                Steps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Download Docker Desktop", Description = "Download Docker Desktop for Mac from docker.com", Command = null },
                    new() { Order = 2, Title = "Install Docker Desktop", Description = "Open the downloaded .dmg file and drag Docker to Applications", Command = null },
                    new() { Order = 3, Title = "Start Docker Desktop", Description = "Open Docker from Applications folder", Command = "open -a Docker" },
                    new() { Order = 4, Title = "Verify Installation", Description = "Check Docker is running", Command = "docker --version && docker compose version" }
                },
                AlternativeMethod = "Homebrew",
                AlternativeSteps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Install via Homebrew", Description = "Install Docker Desktop using Homebrew Cask", Command = "brew install --cask docker" },
                    new() { Order = 2, Title = "Start Docker Desktop", Description = "Open Docker application", Command = "open -a Docker" }
                },
                Notes = "Docker Desktop for Mac includes Docker Engine, Docker CLI, Docker Compose, and Kubernetes.",
                DownloadUrl = "https://docs.docker.com/desktop/install/mac-install/"
            },
            "Linux" => new DockerInstallationGuide
            {
                Platform = platform,
                RecommendedMethod = "Official Docker Repository",
                Steps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Update package index", Description = "Update apt package index", Command = "sudo apt-get update" },
                    new() { Order = 2, Title = "Install prerequisites", Description = "Install packages to allow apt to use HTTPS", Command = "sudo apt-get install -y ca-certificates curl gnupg" },
                    new() { Order = 3, Title = "Add Docker GPG key", Description = "Add Docker's official GPG key", Command = "sudo install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg && sudo chmod a+r /etc/apt/keyrings/docker.gpg" },
                    new() { Order = 4, Title = "Add Docker repository", Description = "Set up the Docker repository", Command = "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null" },
                    new() { Order = 5, Title = "Install Docker Engine", Description = "Install Docker Engine, CLI, and Compose", Command = "sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin" },
                    new() { Order = 6, Title = "Add user to docker group", Description = "Add current user to docker group (optional)", Command = "sudo usermod -aG docker $USER" },
                    new() { Order = 7, Title = "Start Docker service", Description = "Enable and start Docker service", Command = "sudo systemctl enable docker && sudo systemctl start docker" },
                    new() { Order = 8, Title = "Verify Installation", Description = "Check Docker is running", Command = "docker --version && docker compose version" }
                },
                AlternativeMethod = "Snap",
                AlternativeSteps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Install via Snap", Description = "Install Docker using Snap", Command = "sudo snap install docker" }
                },
                Notes = "After installation, you may need to log out and back in for group changes to take effect.",
                DownloadUrl = "https://docs.docker.com/engine/install/ubuntu/"
            },
            "Windows" => new DockerInstallationGuide
            {
                Platform = platform,
                RecommendedMethod = "Docker Desktop",
                Steps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Enable WSL 2", Description = "Enable Windows Subsystem for Linux 2", Command = "wsl --install" },
                    new() { Order = 2, Title = "Download Docker Desktop", Description = "Download Docker Desktop for Windows from docker.com", Command = null },
                    new() { Order = 3, Title = "Install Docker Desktop", Description = "Run the installer and follow the prompts", Command = null },
                    new() { Order = 4, Title = "Restart Computer", Description = "Restart your computer after installation", Command = null },
                    new() { Order = 5, Title = "Start Docker Desktop", Description = "Launch Docker Desktop from Start Menu", Command = null },
                    new() { Order = 6, Title = "Verify Installation", Description = "Open PowerShell and verify", Command = "docker --version; docker compose version" }
                },
                AlternativeMethod = "Chocolatey",
                AlternativeSteps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Install via Chocolatey", Description = "Install Docker Desktop using Chocolatey", Command = "choco install docker-desktop" }
                },
                Notes = "Docker Desktop requires Windows 10/11 Pro, Enterprise, or Education with Hyper-V and WSL 2 enabled.",
                DownloadUrl = "https://docs.docker.com/desktop/install/windows-install/"
            },
            _ => new DockerInstallationGuide
            {
                Platform = platform,
                RecommendedMethod = "Manual Installation",
                Steps = new List<InstallationStep>
                {
                    new() { Order = 1, Title = "Visit Docker documentation", Description = "Follow platform-specific installation guide", Command = null }
                },
                Notes = "Please refer to the official Docker documentation for your platform.",
                DownloadUrl = "https://docs.docker.com/engine/install/"
            }
        };
    }

    /// <summary>
    /// Attempts to start Docker daemon (platform-specific).
    /// </summary>
    public async Task<CommandResult> StartDockerAsync()
    {
        var platform = GetPlatform();

        return platform switch
        {
            "macOS" => await ExecuteCommandAsync("open", "-a Docker"),
            "Linux" => await ExecuteCommandAsync("sudo", "systemctl start docker"),
            "Windows" => await ExecuteCommandAsync("powershell", "Start-Process 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'"),
            _ => new CommandResult { Success = false, Error = "Unsupported platform" }
        };
    }

    /// <summary>
    /// Attempts to install Docker (platform-specific).
    /// On macOS, uses Homebrew to install Docker Desktop.
    /// On Linux, uses the official Docker installation script.
    /// </summary>
    public async Task<InstallationResult> InstallDockerAsync(Action<string, int>? progressCallback = null)
    {
        var platform = GetPlatform();
        var result = new InstallationResult { Platform = platform };

        _logger.LogInformation("Starting Docker installation on {Platform}", platform);

        try
        {
            switch (platform)
            {
                case "macOS":
                    result = await InstallDockerOnMacOS(progressCallback);
                    break;
                case "Linux":
                    result = await InstallDockerOnLinux(progressCallback);
                    break;
                case "Windows":
                    result.Success = false;
                    result.Message = "Automatic Docker installation on Windows requires manual download. Please visit https://docs.docker.com/desktop/install/windows-install/";
                    result.RequiresManualAction = true;
                    break;
                default:
                    result.Success = false;
                    result.Message = "Unsupported platform for automatic installation";
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Docker installation failed");
            result.Success = false;
            result.Message = $"Installation failed: {ex.Message}";
            result.Error = ex.Message;
        }

        return result;
    }

    private async Task<InstallationResult> InstallDockerOnMacOS(Action<string, int>? progressCallback)
    {
        var result = new InstallationResult { Platform = "macOS" };

        // Check if Homebrew is installed
        progressCallback?.Invoke("Checking for Homebrew...", 5);
        var brewCheck = await ExecuteCommandAsync("/opt/homebrew/bin/brew", "--version");
        if (!brewCheck.Success)
        {
            // Try the Intel Mac path
            brewCheck = await ExecuteCommandAsync("/usr/local/bin/brew", "--version");
        }

        if (!brewCheck.Success)
        {
            result.Success = false;
            result.Message = "Homebrew is not installed. Please install Homebrew first: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"";
            result.RequiresManualAction = true;
            return result;
        }

        var brewPath = File.Exists("/opt/homebrew/bin/brew") ? "/opt/homebrew/bin/brew" : "/usr/local/bin/brew";

        // Install Docker Desktop using Homebrew
        progressCallback?.Invoke("Installing Docker Desktop via Homebrew...", 20);
        _logger.LogInformation("Installing Docker Desktop via Homebrew");

        var installResult = await ExecuteCommandAsync(brewPath, "install --cask docker", timeoutSeconds: 600);

        if (!installResult.Success)
        {
            result.Success = false;
            result.Message = $"Homebrew installation failed: {installResult.Error}";
            result.Error = installResult.Error;
            result.Output = installResult.Output;
            return result;
        }

        progressCallback?.Invoke("Docker Desktop installed. Starting Docker...", 80);

        // Start Docker Desktop
        var startResult = await ExecuteCommandAsync("open", "-a Docker");
        
        progressCallback?.Invoke("Waiting for Docker to start...", 90);
        
        // Wait for Docker to be ready
        for (int i = 0; i < 30; i++)
        {
            await Task.Delay(2000);
            var statusCheck = await ExecuteCommandAsync("docker", "info", timeoutSeconds: 5);
            if (statusCheck.Success)
            {
                progressCallback?.Invoke("Docker is ready!", 100);
                result.Success = true;
                result.Message = "Docker Desktop installed and started successfully!";
                return result;
            }
        }

        result.Success = true;
        result.Message = "Docker Desktop installed. Please complete the setup in the Docker Desktop application.";
        result.RequiresManualAction = true;
        return result;
    }

    private async Task<InstallationResult> InstallDockerOnLinux(Action<string, int>? progressCallback)
    {
        var result = new InstallationResult { Platform = "Linux" };

        progressCallback?.Invoke("Downloading Docker installation script...", 10);

        // Use the convenience script for Linux
        var curlResult = await ExecuteCommandAsync("curl", "-fsSL https://get.docker.com -o /tmp/get-docker.sh", timeoutSeconds: 60);
        
        if (!curlResult.Success)
        {
            result.Success = false;
            result.Message = $"Failed to download Docker install script: {curlResult.Error}";
            return result;
        }

        progressCallback?.Invoke("Running Docker installation script (requires sudo)...", 30);
        
        var installResult = await ExecuteCommandAsync("sudo", "sh /tmp/get-docker.sh", timeoutSeconds: 600);

        if (!installResult.Success)
        {
            result.Success = false;
            result.Message = $"Docker installation failed: {installResult.Error}";
            result.Error = installResult.Error;
            return result;
        }

        progressCallback?.Invoke("Adding current user to docker group...", 70);
        
        // Add current user to docker group
        var user = Environment.UserName;
        await ExecuteCommandAsync("sudo", $"usermod -aG docker {user}");

        progressCallback?.Invoke("Starting Docker service...", 85);
        
        // Start Docker service
        await ExecuteCommandAsync("sudo", "systemctl enable docker");
        await ExecuteCommandAsync("sudo", "systemctl start docker");

        progressCallback?.Invoke("Docker installed successfully!", 100);

        result.Success = true;
        result.Message = "Docker installed successfully! You may need to log out and back in for group changes to take effect.";
        result.RequiresManualAction = true;
        return result;
    }

    /// <summary>
    /// Runs a Docker container.
    /// </summary>
    public async Task<CommandResult> RunContainerAsync(DockerRunOptions options)
    {
        var args = new List<string> { "run" };
        
        if (options.Detached) args.Add("-d");
        if (options.Remove) args.Add("--rm");
        if (!string.IsNullOrEmpty(options.Name)) args.AddRange(new[] { "--name", options.Name });
        
        foreach (var port in options.Ports ?? Array.Empty<string>())
        {
            args.AddRange(new[] { "-p", port });
        }
        
        foreach (var env in options.Environment ?? new Dictionary<string, string>())
        {
            args.AddRange(new[] { "-e", $"{env.Key}={env.Value}" });
        }
        
        foreach (var volume in options.Volumes ?? Array.Empty<string>())
        {
            args.AddRange(new[] { "-v", volume });
        }
        
        if (!string.IsNullOrEmpty(options.Network))
        {
            args.AddRange(new[] { "--network", options.Network });
        }
        
        args.Add(options.Image);
        
        if (!string.IsNullOrEmpty(options.Command))
        {
            args.Add(options.Command);
        }

        return await ExecuteCommandAsync("docker", string.Join(" ", args));
    }

    /// <summary>
    /// Stops a Docker container.
    /// </summary>
    public async Task<CommandResult> StopContainerAsync(string containerIdOrName)
    {
        return await ExecuteCommandAsync("docker", $"stop {containerIdOrName}");
    }

    /// <summary>
    /// Removes a Docker container.
    /// </summary>
    public async Task<CommandResult> RemoveContainerAsync(string containerIdOrName, bool force = false)
    {
        var forceFlag = force ? "-f " : "";
        return await ExecuteCommandAsync("docker", $"rm {forceFlag}{containerIdOrName}");
    }

    /// <summary>
    /// Pulls a Docker image.
    /// </summary>
    public async Task<CommandResult> PullImageAsync(string image)
    {
        return await ExecuteCommandAsync("docker", $"pull {image}", timeoutSeconds: 300);
    }

    /// <summary>
    /// Gets container logs.
    /// </summary>
    public async Task<CommandResult> GetContainerLogsAsync(string containerIdOrName, int? tail = null)
    {
        var tailFlag = tail.HasValue ? $"--tail {tail.Value} " : "";
        return await ExecuteCommandAsync("docker", $"logs {tailFlag}{containerIdOrName}");
    }

    /// <summary>
    /// Runs docker-compose up.
    /// </summary>
    public async Task<CommandResult> ComposeUpAsync(string composeFilePath, bool detached = true, bool build = false)
    {
        var flags = new List<string>();
        if (detached) flags.Add("-d");
        if (build) flags.Add("--build");
        
        var flagsStr = flags.Count > 0 ? string.Join(" ", flags) + " " : "";
        return await ExecuteCommandAsync("docker", $"compose -f {composeFilePath} up {flagsStr}", timeoutSeconds: 600);
    }

    /// <summary>
    /// Runs docker-compose down.
    /// </summary>
    public async Task<CommandResult> ComposeDownAsync(string composeFilePath, bool removeVolumes = false)
    {
        var volumeFlag = removeVolumes ? "-v " : "";
        return await ExecuteCommandAsync("docker", $"compose -f {composeFilePath} down {volumeFlag}");
    }

    /// <summary>
    /// Gets docker-compose project status.
    /// </summary>
    public async Task<CommandResult> ComposeStatusAsync(string composeFilePath)
    {
        return await ExecuteCommandAsync("docker", $"compose -f {composeFilePath} ps --format json");
    }

    /// <summary>
    /// Executes a Docker system prune.
    /// </summary>
    public async Task<CommandResult> PruneSystemAsync(bool all = false, bool volumes = false)
    {
        var flags = new List<string> { "-f" };
        if (all) flags.Add("-a");
        if (volumes) flags.Add("--volumes");
        
        return await ExecuteCommandAsync("docker", $"system prune {string.Join(" ", flags)}");
    }

    #region Private Helper Methods

    private string GetPlatform()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return "macOS";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            return "Linux";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "Windows";
        return "Unknown";
    }

    /// <summary>
    /// Gets Docker version from Docker Desktop's Info.plist file (macOS only).
    /// </summary>
    private string? GetDockerVersionFromPlist()
    {
        try
        {
            var plistPath = "/Applications/Docker.app/Contents/Info.plist";
            if (!File.Exists(plistPath))
                return null;

            var plistContent = File.ReadAllText(plistPath);
            
            // Simple parsing - look for CFBundleShortVersionString
            var versionKey = "<key>CFBundleShortVersionString</key>";
            var keyIndex = plistContent.IndexOf(versionKey);
            if (keyIndex == -1)
                return null;

            var stringStart = plistContent.IndexOf("<string>", keyIndex);
            if (stringStart == -1)
                return null;

            stringStart += "<string>".Length;
            var stringEnd = plistContent.IndexOf("</string>", stringStart);
            if (stringEnd == -1)
                return null;

            return plistContent.Substring(stringStart, stringEnd - stringStart);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read Docker version from Info.plist");
            return null;
        }
    }

    /// <summary>
    /// Checks if Docker Desktop process is running (macOS only).
    /// </summary>
    private bool IsDockerDesktopRunning()
    {
        try
        {
            var result = ExecuteCommandAsync("pgrep", "-f \"Docker.app\"", timeoutSeconds: 2).GetAwaiter().GetResult();
            return result.Success && !string.IsNullOrWhiteSpace(result.Output);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Resolves the full path to a command, checking common locations.
    /// </summary>
    private string ResolveCommandPath(string command)
    {
        // If it's already a full path, return it
        if (Path.IsPathRooted(command) && File.Exists(command))
            return command;

        // Common paths to check for Docker and other tools
        var searchPaths = new[]
        {
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/usr/bin",
            "/bin",
            "/Applications/Docker.app/Contents/Resources/bin",
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) + "\\Docker\\Docker\\resources\\bin",
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) + "\\Docker\\Docker\\resources"
        };

        foreach (var path in searchPaths)
        {
            var fullPath = Path.Combine(path, command);
            if (File.Exists(fullPath))
            {
                _logger.LogDebug("Resolved {Command} to {FullPath}", command, fullPath);
                return fullPath;
            }
            
            // On Windows, check for .exe extension
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                var exePath = fullPath + ".exe";
                if (File.Exists(exePath))
                {
                    _logger.LogDebug("Resolved {Command} to {FullPath}", command, exePath);
                    return exePath;
                }
            }
        }

        // Fall back to the original command and let the system try to resolve it
        return command;
    }

    private async Task<CommandResult> ExecuteCommandAsync(string command, string arguments = "", int timeoutSeconds = 5)
    {
        try
        {
            // Resolve command to full path - use the actual binary, not symlinks
            string fileName;
            string processArguments;
            
            if (command == "docker" && RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                // Use wrapper script to avoid .NET Process spawning issues on macOS
                var wrapperPath = Path.Combine(AppContext.BaseDirectory, "docker-wrapper.sh");
                if (File.Exists(wrapperPath))
                {
                    fileName = wrapperPath;
                    processArguments = arguments;
                    _logger.LogDebug("Executing Docker command (via wrapper): {Command} {Arguments}", fileName, processArguments);
                }
                else
                {
                    // Fallback to direct binary
                    fileName = "/Applications/Docker.app/Contents/Resources/bin/docker";
                    processArguments = arguments;
                    _logger.LogDebug("Executing Docker command (direct binary, no wrapper found): {Command} {Arguments}", fileName, processArguments);
                }
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Resolve the full path to the command for Windows
                var resolvedCommand = ResolveCommandPath(command);
                fileName = resolvedCommand;
                processArguments = arguments;
                _logger.LogDebug("Executing command (Windows): {Command} {Arguments}", fileName, processArguments);
            }
            else
            {
                // For other commands on Unix, resolve the path
                fileName = ResolveCommandPath(command);
                processArguments = arguments;
                _logger.LogDebug("Executing command (Unix): {Command} {Arguments}", fileName, processArguments);
            }
            
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = processArguments,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    RedirectStandardInput = true,  // Redirect stdin
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            // Set environment variables to prevent Docker from waiting for interactive input
            process.StartInfo.Environment["DOCKER_CLI_HINTS"] = "false";
            process.StartInfo.Environment["DOCKER_BUILDKIT"] = "1";
            
            // For Windows, add common paths to PATH environment variable
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                var currentPath = Environment.GetEnvironmentVariable("PATH") ?? "";
                var additionalPaths = new[]
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) + "\\Docker\\Docker\\resources\\bin",
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) + "\\Docker\\Docker\\resources"
                };
                process.StartInfo.Environment["PATH"] = string.Join(";", additionalPaths) + ";" + currentPath;
            }

            process.Start();
            
            // Close stdin immediately to prevent child processes from waiting for input
            process.StandardInput.Close();

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();

            var completed = await Task.WhenAny(
                Task.WhenAll(outputTask, errorTask, process.WaitForExitAsync()),
                Task.Delay(TimeSpan.FromSeconds(timeoutSeconds))
            );

            if (completed != Task.WhenAll(outputTask, errorTask, process.WaitForExitAsync()))
            {
                try { process.Kill(); } catch { }
                return new CommandResult
                {
                    Success = false,
                    Error = "Command timed out"
                };
            }

            var output = await outputTask;
            var error = await errorTask;

            return new CommandResult
            {
                Success = process.ExitCode == 0,
                Output = output.Trim(),
                Error = error.Trim(),
                ExitCode = process.ExitCode
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing command: {Command} {Arguments}", command, arguments);
            return new CommandResult
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    private string ParseVersion(string output, string prefix)
    {
        // Parse versions like "Docker version 24.0.6, build ed223bc" or "Docker Compose version v2.21.0"
        var parts = output.Split(new[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < parts.Length; i++)
        {
            if (parts[i].StartsWith("v") || char.IsDigit(parts[i].FirstOrDefault()))
            {
                return parts[i].TrimStart('v');
            }
        }
        return output.Trim();
    }

    private DockerInfo? ParseDockerInfo(string output)
    {
        // Try to parse JSON output
        try
        {
            // Clean the output (remove quotes if wrapped)
            var json = output.Trim().Trim('\'');
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            return new DockerInfo
            {
                ServerVersion = root.TryGetProperty("ServerVersion", out var sv) ? sv.GetString() : null,
                OperatingSystem = root.TryGetProperty("OperatingSystem", out var os) ? os.GetString() : null,
                Architecture = root.TryGetProperty("Architecture", out var arch) ? arch.GetString() : null,
                Containers = root.TryGetProperty("Containers", out var c) ? c.GetInt32() : 0,
                ContainersRunning = root.TryGetProperty("ContainersRunning", out var cr) ? cr.GetInt32() : 0,
                ContainersPaused = root.TryGetProperty("ContainersPaused", out var cp) ? cp.GetInt32() : 0,
                ContainersStopped = root.TryGetProperty("ContainersStopped", out var cs) ? cs.GetInt32() : 0,
                Images = root.TryGetProperty("Images", out var img) ? img.GetInt32() : 0,
                MemoryTotal = root.TryGetProperty("MemTotal", out var mem) ? mem.GetInt64() : 0,
                NCPU = root.TryGetProperty("NCPU", out var cpu) ? cpu.GetInt32() : 0
            };
        }
        catch
        {
            return null;
        }
    }

    private List<ContainerInfo> ParseContainers(string output)
    {
        var containers = new List<ContainerInfo>();
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            try
            {
                var json = line.Trim().Trim('\'');
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                containers.Add(new ContainerInfo
                {
                    Id = root.TryGetProperty("ID", out var id) ? id.GetString() : null,
                    Names = root.TryGetProperty("Names", out var names) ? names.GetString() : null,
                    Image = root.TryGetProperty("Image", out var image) ? image.GetString() : null,
                    Status = root.TryGetProperty("Status", out var status) ? status.GetString() : null,
                    State = root.TryGetProperty("State", out var state) ? state.GetString() : null,
                    Ports = root.TryGetProperty("Ports", out var ports) ? ports.GetString() : null,
                    CreatedAt = root.TryGetProperty("CreatedAt", out var created) ? created.GetString() : null
                });
            }
            catch
            {
                // Skip malformed lines
            }
        }

        return containers;
    }

    private List<ImageInfo> ParseImages(string output)
    {
        var images = new List<ImageInfo>();
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            try
            {
                var json = line.Trim().Trim('\'');
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                images.Add(new ImageInfo
                {
                    Id = root.TryGetProperty("ID", out var id) ? id.GetString() : null,
                    Repository = root.TryGetProperty("Repository", out var repo) ? repo.GetString() : null,
                    Tag = root.TryGetProperty("Tag", out var tag) ? tag.GetString() : null,
                    Size = root.TryGetProperty("Size", out var size) ? size.GetString() : null,
                    CreatedAt = root.TryGetProperty("CreatedAt", out var created) ? created.GetString() : null,
                    CreatedSince = root.TryGetProperty("CreatedSince", out var since) ? since.GetString() : null
                });
            }
            catch
            {
                // Skip malformed lines
            }
        }

        return images;
    }

    private List<NetworkInfo> ParseNetworks(string output)
    {
        var networks = new List<NetworkInfo>();
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            try
            {
                var json = line.Trim().Trim('\'');
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                networks.Add(new NetworkInfo
                {
                    Id = root.TryGetProperty("ID", out var id) ? id.GetString() : null,
                    Name = root.TryGetProperty("Name", out var name) ? name.GetString() : null,
                    Driver = root.TryGetProperty("Driver", out var driver) ? driver.GetString() : null,
                    Scope = root.TryGetProperty("Scope", out var scope) ? scope.GetString() : null
                });
            }
            catch
            {
                // Skip malformed lines
            }
        }

        return networks;
    }

    private List<VolumeInfo> ParseVolumes(string output)
    {
        var volumes = new List<VolumeInfo>();
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            try
            {
                var json = line.Trim().Trim('\'');
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                volumes.Add(new VolumeInfo
                {
                    Name = root.TryGetProperty("Name", out var name) ? name.GetString() : null,
                    Driver = root.TryGetProperty("Driver", out var driver) ? driver.GetString() : null,
                    Mountpoint = root.TryGetProperty("Mountpoint", out var mp) ? mp.GetString() : null
                });
            }
            catch
            {
                // Skip malformed lines
            }
        }

        return volumes;
    }

    #endregion
}

#region Data Models

public class DockerStatus
{
    public string Platform { get; set; } = string.Empty;
    public DateTime CheckedAt { get; set; }
    
    // Docker Engine
    public bool DockerInstalled { get; set; }
    public string? DockerVersion { get; set; }
    public bool DockerRunning { get; set; }
    public DockerInfo? DockerInfo { get; set; }
    
    // Docker Compose
    public bool DockerComposeInstalled { get; set; }
    public string? DockerComposeVersion { get; set; }
    public bool DockerComposeV2 { get; set; }
    
    // Resources
    public List<ContainerInfo> RunningContainers { get; set; } = new();
    public List<ContainerInfo> AllContainers { get; set; } = new();
    public List<ImageInfo> Images { get; set; } = new();
    public List<NetworkInfo> Networks { get; set; } = new();
    public List<VolumeInfo> Volumes { get; set; } = new();
}

public class DockerInfo
{
    public string? ServerVersion { get; set; }
    public string? OperatingSystem { get; set; }
    public string? Architecture { get; set; }
    public int Containers { get; set; }
    public int ContainersRunning { get; set; }
    public int ContainersPaused { get; set; }
    public int ContainersStopped { get; set; }
    public int Images { get; set; }
    public long MemoryTotal { get; set; }
    public int NCPU { get; set; }
}

public class ContainerInfo
{
    public string? Id { get; set; }
    public string? Names { get; set; }
    public string? Image { get; set; }
    public string? Status { get; set; }
    public string? State { get; set; }
    public string? Ports { get; set; }
    public string? CreatedAt { get; set; }
}

public class ImageInfo
{
    public string? Id { get; set; }
    public string? Repository { get; set; }
    public string? Tag { get; set; }
    public string? Size { get; set; }
    public string? CreatedAt { get; set; }
    public string? CreatedSince { get; set; }
}

public class NetworkInfo
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Driver { get; set; }
    public string? Scope { get; set; }
}

public class VolumeInfo
{
    public string? Name { get; set; }
    public string? Driver { get; set; }
    public string? Mountpoint { get; set; }
}

public class DockerInstallationGuide
{
    public string Platform { get; set; } = string.Empty;
    public string RecommendedMethod { get; set; } = string.Empty;
    public List<InstallationStep> Steps { get; set; } = new();
    public string? AlternativeMethod { get; set; }
    public List<InstallationStep>? AlternativeSteps { get; set; }
    public string? Notes { get; set; }
    public string? DownloadUrl { get; set; }
}

public class InstallationStep
{
    public int Order { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Command { get; set; }
}

public class DockerRunOptions
{
    public string Image { get; set; } = string.Empty;
    public string? Name { get; set; }
    public bool Detached { get; set; } = true;
    public bool Remove { get; set; }
    public string[]? Ports { get; set; }
    public Dictionary<string, string>? Environment { get; set; }
    public string[]? Volumes { get; set; }
    public string? Network { get; set; }
    public string? Command { get; set; }
}

public class CommandResult
{
    public bool Success { get; set; }
    public string Output { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public int ExitCode { get; set; }
}

public class InstallationResult
{
    public bool Success { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Error { get; set; }
    public string? Output { get; set; }
    public bool RequiresManualAction { get; set; }
    public int Progress { get; set; }
    public string? CurrentStep { get; set; }
}

#endregion
