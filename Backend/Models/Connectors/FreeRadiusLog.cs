namespace Backend.Models;

public class FreeRadiusLogEntry
{
    public string Timestamp { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty; // Debug, Info, Warning, Error, Auth
    public string Message { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? NasIpAddress { get; set; }
    public string? ClientIpAddress { get; set; }
    public string? AuthResult { get; set; } // Accept, Reject, Challenge
    public string RawLine { get; set; } = string.Empty;
}

public class LogFilter
{
    public string LogType { get; set; } = "radius"; // radius, auth, radwtmp
    public int Lines { get; set; } = 100;
    public string? SearchTerm { get; set; }
    public string? Level { get; set; } // Debug, Info, Warning, Error, Auth
    public string? Username { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool Follow { get; set; } = false; // For real-time streaming
}

public class LogsResponse
{
    public List<FreeRadiusLogEntry> Entries { get; set; } = new();
    public int TotalLines { get; set; }
    public string LogType { get; set; } = string.Empty;
    public bool IsRealTime { get; set; }
}

public class LogStatistics
{
    public int TotalAuthentications { get; set; }
    public int SuccessfulAuths { get; set; }
    public int FailedAuths { get; set; }
    public int TotalAccounting { get; set; }
    public Dictionary<string, int> ErrorCounts { get; set; } = new();
    public DateTime LastUpdated { get; set; }
}

public class RadwtmpEntry
{
    public string Username { get; set; } = string.Empty;
    public string NasIpAddress { get; set; } = string.Empty;
    public DateTime LoginTime { get; set; }
    public DateTime? LogoutTime { get; set; }
    public string Duration { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
}
