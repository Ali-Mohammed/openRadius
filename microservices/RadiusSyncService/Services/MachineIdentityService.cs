using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace RadiusSyncService.Services;

public class MachineIdentityService
{
    private readonly ILogger<MachineIdentityService> _logger;
    private readonly string _identityFilePath;
    private string? _machineId;
    private string? _approvalToken;

    public MachineIdentityService(ILogger<MachineIdentityService> logger)
    {
        _logger = logger;
        var dataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "OpenRadius");
        Directory.CreateDirectory(dataPath);
        _identityFilePath = Path.Combine(dataPath, ".machine_identity");
    }

    /// <summary>
    /// Gets the unique machine ID
    /// </summary>
    public string GetMachineId()
    {
        if (_machineId != null) return _machineId;

        // Try to load existing ID
        if (File.Exists(_identityFilePath))
        {
            try
            {
                var lines = File.ReadAllLines(_identityFilePath);
                if (lines.Length > 0 && !string.IsNullOrEmpty(lines[0]))
                {
                    _machineId = lines[0];
                    _logger.LogInformation("Loaded existing machine ID");
                    return _machineId;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load existing machine ID");
            }
        }

        // Generate new machine ID
        _machineId = GenerateMachineId();
        SaveIdentity();
        _logger.LogInformation("Generated new machine ID");
        return _machineId;
    }

    /// <summary>
    /// Gets or sets the approval token
    /// </summary>
    public string? GetApprovalToken()
    {
        if (_approvalToken != null) return _approvalToken;

        if (File.Exists(_identityFilePath))
        {
            try
            {
                var lines = File.ReadAllLines(_identityFilePath);
                if (lines.Length > 1 && !string.IsNullOrEmpty(lines[1]))
                {
                    _approvalToken = lines[1];
                    return _approvalToken;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load approval token");
            }
        }

        return null;
    }

    /// <summary>
    /// Sets the approval token
    /// </summary>
    public void SetApprovalToken(string token)
    {
        _approvalToken = token;
        SaveIdentity();
        _logger.LogInformation("Saved approval token");
    }

    /// <summary>
    /// Gets the machine name
    /// </summary>
    public string GetMachineName()
    {
        return Environment.MachineName;
    }

    /// <summary>
    /// Gets the platform information
    /// </summary>
    public string GetPlatform()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return $"Windows {Environment.OSVersion.Version}";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            return $"Linux {Environment.OSVersion.Version}";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return $"macOS {Environment.OSVersion.Version}";
        return "Unknown";
    }

    /// <summary>
    /// Generates a unique machine ID based on hardware identifiers
    /// </summary>
    private string GenerateMachineId()
    {
        var identifiers = new List<string>();

        // Get MAC addresses
        try
        {
            var nics = NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.NetworkInterfaceType != NetworkInterfaceType.Loopback 
                         && n.NetworkInterfaceType != NetworkInterfaceType.Tunnel
                         && n.OperationalStatus == OperationalStatus.Up)
                .OrderBy(n => n.Name)
                .ToList();

            foreach (var nic in nics)
            {
                var mac = nic.GetPhysicalAddress().ToString();
                if (!string.IsNullOrEmpty(mac) && mac != "000000000000")
                {
                    identifiers.Add(mac);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get network interface information");
        }

        // Add machine name
        identifiers.Add(Environment.MachineName);

        // Add OS user
        identifiers.Add(Environment.UserName);

        // Add processor architecture
        identifiers.Add(RuntimeInformation.ProcessArchitecture.ToString());

        // Combine and hash
        var combined = string.Join("|", identifiers);
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(combined));
        return Convert.ToHexString(hash);
    }

    /// <summary>
    /// Saves the machine identity to disk
    /// </summary>
    private void SaveIdentity()
    {
        try
        {
            var lines = new List<string> { _machineId ?? string.Empty };
            if (_approvalToken != null)
            {
                lines.Add(_approvalToken);
            }
            File.WriteAllLines(_identityFilePath, lines);
            _logger.LogInformation("Saved machine identity to {Path}", _identityFilePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save machine identity");
        }
    }
}
