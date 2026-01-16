using System.Diagnostics;
using System.Text.RegularExpressions;
using Backend.Models;

namespace Backend.Services;

public interface IFreeRadiusLogService
{
    Task<LogsResponse> GetLogsAsync(LogFilter filter);
    Task<LogStatistics> GetLogStatisticsAsync();
    Task<List<RadwtmpEntry>> GetRadwtmpEntriesAsync(int limit = 50);
    Task<bool> IsFreeRadiusRunningAsync();
}

public class FreeRadiusLogService : IFreeRadiusLogService
{
    private readonly ILogger<FreeRadiusLogService> _logger;
    private readonly string _containerName = "freeradius";

    public FreeRadiusLogService(ILogger<FreeRadiusLogService> logger)
    {
        _logger = logger;
    }

    public async Task<bool> IsFreeRadiusRunningAsync()
    {
        try
        {
            var result = await ExecuteDockerCommandAsync($"ps --filter name={_containerName} --format {{{{.Names}}}}");
            return !string.IsNullOrWhiteSpace(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check FreeRADIUS container status");
            return false;
        }
    }

    public async Task<LogsResponse> GetLogsAsync(LogFilter filter)
    {
        var response = new LogsResponse
        {
            LogType = filter.LogType,
            IsRealTime = filter.Follow
        };

        try
        {
            string logPath = GetLogPath(filter.LogType);
            string rawLogs = await GetRawLogsAsync(logPath, filter.Lines);

            var entries = ParseLogEntries(rawLogs, filter);
            
            response.Entries = entries;
            response.TotalLines = entries.Count;

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch FreeRADIUS logs");
            throw;
        }
    }

    public async Task<LogStatistics> GetLogStatisticsAsync()
    {
        var stats = new LogStatistics
        {
            LastUpdated = DateTime.UtcNow
        };

        try
        {
            // Get last 1000 lines from radius.log
            var rawLogs = await GetRawLogsAsync("/var/log/freeradius/radius.log", 1000);
            var lines = rawLogs.Split('\n', StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                // Count authentications
                if (line.Contains("Auth:") || line.Contains("Login OK") || line.Contains("Login incorrect"))
                {
                    stats.TotalAuthentications++;
                    
                    if (line.Contains("Login OK") || line.Contains("Access-Accept"))
                    {
                        stats.SuccessfulAuths++;
                    }
                    else if (line.Contains("Login incorrect") || line.Contains("Access-Reject"))
                    {
                        stats.FailedAuths++;
                    }
                }

                // Count accounting
                if (line.Contains("Acct:") || line.Contains("Accounting-Request"))
                {
                    stats.TotalAccounting++;
                }

                // Count errors
                if (line.Contains("ERROR") || line.Contains("Error"))
                {
                    var errorType = ExtractErrorType(line);
                    if (stats.ErrorCounts.ContainsKey(errorType))
                    {
                        stats.ErrorCounts[errorType]++;
                    }
                    else
                    {
                        stats.ErrorCounts[errorType] = 1;
                    }
                }
            }

            return stats;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get log statistics");
            return stats;
        }
    }

    public async Task<List<RadwtmpEntry>> GetRadwtmpEntriesAsync(int limit = 50)
    {
        var entries = new List<RadwtmpEntry>();

        try
        {
            // Use radlast command to read wtmp file
            var command = $"exec {_containerName} radlast -n {limit}";
            var output = await ExecuteDockerCommandAsync(command);

            if (string.IsNullOrWhiteSpace(output))
            {
                return entries;
            }

            var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            
            // Skip header line
            foreach (var line in lines.Skip(1))
            {
                var entry = ParseRadwtmpLine(line);
                if (entry != null)
                {
                    entries.Add(entry);
                }
            }

            return entries;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read radwtmp entries");
            return entries;
        }
    }

    private async Task<string> GetRawLogsAsync(string logPath, int lines)
    {
        try
        {
            // Check if we're trying to read from log files or docker logs
            if (logPath.StartsWith("/var/log/freeradius/"))
            {
                // Try reading from log file first
                var fileCommand = $"exec {_containerName} tail -n {lines} {logPath}";
                var fileContent = await ExecuteDockerCommandAsync(fileCommand);
                
                // If file is empty, fall back to docker logs (which captures stdout/stderr)
                if (string.IsNullOrWhiteSpace(fileContent))
                {
                    _logger.LogInformation("Log file {LogPath} is empty, reading from container stdout/stderr", logPath);
                    return await GetDockerLogsAsync(lines);
                }
                
                return fileContent;
            }
            else
            {
                // For other paths, use docker logs
                return await GetDockerLogsAsync(lines);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read log file: {LogPath}", logPath);
            throw;
        }
    }

    private async Task<string> GetDockerLogsAsync(int lines)
    {
        try
        {
            // Get logs from docker container stdout/stderr
            var command = $"logs --tail {lines} {_containerName}";
            return await ExecuteDockerCommandAsync(command);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read docker logs");
            throw;
        }
    }

    private List<FreeRadiusLogEntry> ParseLogEntries(string rawLogs, LogFilter filter)
    {
        var entries = new List<FreeRadiusLogEntry>();
        var lines = rawLogs.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            var entry = ParseLogLine(line);
            
            // Apply filters
            if (!string.IsNullOrWhiteSpace(filter.SearchTerm) && 
                !entry.Message.Contains(filter.SearchTerm, StringComparison.OrdinalIgnoreCase) &&
                !entry.RawLine.Contains(filter.SearchTerm, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.IsNullOrWhiteSpace(filter.Level) && 
                !entry.Level.Equals(filter.Level, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.IsNullOrWhiteSpace(filter.Username) && 
                (entry.Username == null || !entry.Username.Contains(filter.Username, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            entries.Add(entry);
        }

        return entries;
    }

    private FreeRadiusLogEntry ParseLogLine(string line)
    {
        var entry = new FreeRadiusLogEntry { RawLine = line };

        // Parse timestamp: "Thu Jan 16 10:30:45 2025"
        var timestampMatch = Regex.Match(line, @"^(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})");
        if (timestampMatch.Success)
        {
            entry.Timestamp = timestampMatch.Groups[1].Value;
        }

        // Determine log level
        if (line.Contains("ERROR") || line.Contains("Error"))
            entry.Level = "Error";
        else if (line.Contains("WARNING") || line.Contains("Warning"))
            entry.Level = "Warning";
        else if (line.Contains("Auth:") || line.Contains("Login"))
            entry.Level = "Auth";
        else if (line.Contains("Debug"))
            entry.Level = "Debug";
        else
            entry.Level = "Info";

        // Extract username
        var userMatch = Regex.Match(line, @"User-Name\s*=\s*""?([^""]+)""?|Login\s+(?:OK|incorrect):\s+\[([^\]]+)\]");
        if (userMatch.Success)
        {
            entry.Username = userMatch.Groups[1].Success ? userMatch.Groups[1].Value : userMatch.Groups[2].Value;
        }

        // Extract NAS IP
        var nasMatch = Regex.Match(line, @"NAS-IP-Address\s*=\s*([0-9.]+)");
        if (nasMatch.Success)
        {
            entry.NasIpAddress = nasMatch.Groups[1].Value;
        }

        // Extract client IP
        var clientMatch = Regex.Match(line, @"from\s+host\s+([0-9.]+)|Framed-IP-Address\s*=\s*([0-9.]+)");
        if (clientMatch.Success)
        {
            entry.ClientIpAddress = clientMatch.Groups[1].Success ? clientMatch.Groups[1].Value : clientMatch.Groups[2].Value;
        }

        // Determine auth result
        if (line.Contains("Access-Accept") || line.Contains("Login OK"))
            entry.AuthResult = "Accept";
        else if (line.Contains("Access-Reject") || line.Contains("Login incorrect"))
            entry.AuthResult = "Reject";
        else if (line.Contains("Access-Challenge"))
            entry.AuthResult = "Challenge";

        // Extract message (remove timestamp)
        entry.Message = timestampMatch.Success 
            ? line.Substring(timestampMatch.Length).Trim() 
            : line;

        return entry;
    }

    private RadwtmpEntry? ParseRadwtmpLine(string line)
    {
        try
        {
            // radlast output format: username  nas  login-time  logout-time  duration
            var parts = Regex.Split(line, @"\s{2,}"); // Split by 2+ spaces
            
            if (parts.Length < 3)
                return null;

            var entry = new RadwtmpEntry
            {
                Username = parts[0].Trim(),
                NasIpAddress = parts.Length > 1 ? parts[1].Trim() : "",
            };

            // Parse login time
            if (parts.Length > 2 && DateTime.TryParse(parts[2], out var loginTime))
            {
                entry.LoginTime = loginTime;
            }

            // Check if still logged in
            if (line.Contains("still logged in"))
            {
                entry.IsOnline = true;
            }
            else if (parts.Length > 3)
            {
                if (DateTime.TryParse(parts[3], out var logoutTime))
                {
                    entry.LogoutTime = logoutTime;
                    entry.IsOnline = false;
                }
            }

            // Parse duration
            if (parts.Length > 4)
            {
                entry.Duration = parts[4].Trim();
            }

            return entry;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse radwtmp line: {Line}", line);
            return null;
        }
    }

    private string GetLogPath(string logType)
    {
        return logType.ToLower() switch
        {
            "radius" => "/var/log/freeradius/radius.log",
            "auth" => "/var/log/freeradius/auth.log",
            "radwtmp" => "/var/log/freeradius/radwtmp",
            _ => "/var/log/freeradius/radius.log"
        };
    }

    private string ExtractErrorType(string line)
    {
        if (line.Contains("SQL"))
            return "SQL Error";
        if (line.Contains("authentication"))
            return "Authentication Error";
        if (line.Contains("configuration") || line.Contains("config"))
            return "Configuration Error";
        if (line.Contains("connection") || line.Contains("socket"))
            return "Connection Error";
        
        return "General Error";
    }

    private async Task<string> ExecuteDockerCommandAsync(string command)
    {
        try
        {
            var processStartInfo = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = command,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = processStartInfo };
            process.Start();

            var output = await process.StandardOutput.ReadToEndAsync();
            var error = await process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync();

            if (process.ExitCode != 0 && !string.IsNullOrWhiteSpace(error))
            {
                _logger.LogWarning("Docker command failed: {Error}", error);
            }

            return output;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute docker command: {Command}", command);
            throw;
        }
    }
}
