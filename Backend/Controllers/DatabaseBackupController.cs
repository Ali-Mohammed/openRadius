using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using System.Diagnostics;
using System.Text;

namespace Backend.Controllers;

[ApiController]
[Route("api/database-backup")]
[Authorize]
public class DatabaseBackupController : ControllerBase
{
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<DatabaseBackupController> _logger;
    private readonly IConfiguration _configuration;

    public DatabaseBackupController(
        MasterDbContext masterContext,
        ILogger<DatabaseBackupController> logger,
        IConfiguration configuration)
    {
        _masterContext = masterContext;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpGet("list")]
    public async Task<ActionResult<IEnumerable<DatabaseInfo>>> GetDatabases()
    {
        try
        {
            var databases = new List<DatabaseInfo>();

            // Add master database
            var masterConnectionString = _configuration.GetConnectionString("DefaultConnection") ?? "";
            var masterDbName = ExtractDatabaseName(masterConnectionString);
            databases.Add(new DatabaseInfo
            {
                Name = masterDbName ?? "master",
                DisplayName = "Master Database",
                Type = "master",
                ConnectionString = masterConnectionString
            });

        // Add workspace databases
        var workspaces = await _masterContext.Workspaces
            .Where(w => w.DeletedAt == null)
            .ToListAsync();

        foreach (var workspace in workspaces)
        {
            var dbName = $"openradius_workspace_{workspace.Id}";
            var workspaceConnectionString = GetWorkspaceConnectionString(dbName);
            databases.Add(new DatabaseInfo
            {
                Name = dbName,
                DisplayName = $"{workspace.Name} (Workspace)",
                Type = "workspace",
                WorkspaceId = workspace.Id,
                ConnectionString = workspaceConnectionString
            });
        }

        return Ok(databases);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting database list");
            return StatusCode(500, new { message = "Failed to retrieve databases", error = ex.Message });
        }
    }

    [HttpPost("backup")]
    public async Task<IActionResult> BackupDatabase([FromBody] BackupRequest request)
    {
        try
        {
            var connectionString = request.Type == "master"
                ? _configuration.GetConnectionString("DefaultConnection")
                : GetWorkspaceConnectionString(request.DatabaseName);

            var dbName = ExtractDatabaseName(connectionString);
            var host = ExtractHost(connectionString);
            var port = ExtractPort(connectionString);
            var username = ExtractUsername(connectionString);
            var password = ExtractPassword(connectionString);

            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var backupFileName = $"{dbName}_{timestamp}.sql";
            var backupPath = Path.Combine(Path.GetTempPath(), backupFileName);

            // Use pg_dump to create backup
            var processInfo = new ProcessStartInfo
            {
                FileName = "pg_dump",
                Arguments = $"-h {host} -p {port} -U {username} -F p -f \"{backupPath}\" {dbName}",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            // Set password environment variable
            processInfo.Environment["PGPASSWORD"] = password;

            using var process = Process.Start(processInfo);
            if (process == null)
            {
                return StatusCode(500, new { message = "Failed to start pg_dump process" });
            }

            var output = await process.StandardOutput.ReadToEndAsync();
            var error = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
            {
                _logger.LogError("pg_dump failed: {Error}", error);
                return StatusCode(500, new { message = "Backup failed", error });
            }

            var fileBytes = await System.IO.File.ReadAllBytesAsync(backupPath);
            System.IO.File.Delete(backupPath);

            return File(fileBytes, "application/sql", backupFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating database backup");
            return StatusCode(500, new { message = "Failed to create backup", error = ex.Message });
        }
    }

    [HttpGet("backup-history")]
    public ActionResult<IEnumerable<BackupHistoryDto>> GetBackupHistory()
    {
        try
        {
            // This would typically come from a database table tracking backups
            // For now, returning empty list as backups are downloaded immediately
            return Ok(new List<BackupHistoryDto>());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting backup history");
            return StatusCode(500, new { message = "Failed to retrieve backup history", error = ex.Message });
        }
    }

    // Helper methods
    private string GetWorkspaceConnectionString(string databaseName)
    {
        var masterConnectionString = _configuration.GetConnectionString("DefaultConnection");
        return masterConnectionString?.Replace(ExtractDatabaseName(masterConnectionString), databaseName) ?? "";
    }

    private string ExtractDatabaseName(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "";
        var match = System.Text.RegularExpressions.Regex.Match(connectionString, @"Database=([^;]+)");
        return match.Success ? match.Groups[1].Value : "";
    }

    private string ExtractHost(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "localhost";
        var match = System.Text.RegularExpressions.Regex.Match(connectionString, @"Host=([^;]+)");
        return match.Success ? match.Groups[1].Value : "localhost";
    }

    private string ExtractPort(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "5432";
        var match = System.Text.RegularExpressions.Regex.Match(connectionString, @"Port=([^;]+)");
        return match.Success ? match.Groups[1].Value : "5432";
    }

    private string ExtractUsername(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "postgres";
        var match = System.Text.RegularExpressions.Regex.Match(connectionString, @"Username=([^;]+)");
        return match.Success ? match.Groups[1].Value : "postgres";
    }

    private string ExtractPassword(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "";
        var match = System.Text.RegularExpressions.Regex.Match(connectionString, @"Password=([^;]+)");
        return match.Success ? match.Groups[1].Value : "";
    }
}

// DTOs
public class DatabaseInfo
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int? WorkspaceId { get; set; }
    public string ConnectionString { get; set; } = string.Empty;
}

public class BackupRequest
{
    public string DatabaseName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public class BackupHistoryDto
{
    public Guid Id { get; set; }
    public string DatabaseName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}
