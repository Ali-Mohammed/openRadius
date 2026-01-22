using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
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
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var backupFileName = $"{dbName}_{timestamp}.sql";

            // Create backups directory if it doesn't exist
            var backupsDir = Path.Combine(Directory.GetCurrentDirectory(), "Backups");
            if (!Directory.Exists(backupsDir))
            {
                Directory.CreateDirectory(backupsDir);
            }

            var backupFilePath = Path.Combine(backupsDir, backupFileName);

            // Create SQL backup using Npgsql
            var sqlBackup = new StringBuilder();
            sqlBackup.AppendLine($"-- Database backup for {dbName}");
            sqlBackup.AppendLine($"-- Generated on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            sqlBackup.AppendLine();

            using var connection = new Npgsql.NpgsqlConnection(connectionString);
            await connection.OpenAsync();

            // Get all tables
            var tables = await GetTableNames(connection);

            foreach (var table in tables)
            {
                sqlBackup.AppendLine($"-- Table: {table}");
                sqlBackup.AppendLine($"DROP TABLE IF EXISTS \"{table}\" CASCADE;");
                
                // Get CREATE TABLE statement
                var createTableSql = await GetCreateTableStatement(connection, table);
                sqlBackup.AppendLine(createTableSql);
                sqlBackup.AppendLine();

                // Get table data as INSERT statements
                var insertStatements = await GenerateInsertStatements(connection, table);
                if (!string.IsNullOrEmpty(insertStatements))
                {
                    sqlBackup.AppendLine(insertStatements);
                    sqlBackup.AppendLine();
                }
            }

            var fileBytes = Encoding.UTF8.GetBytes(sqlBackup.ToString());
            
            // Save backup to disk
            await System.IO.File.WriteAllBytesAsync(backupFilePath, fileBytes);

            // Save backup history to database
            var backupHistory = new Models.BackupHistory
            {
                DatabaseName = request.DatabaseName,
                DatabaseType = request.Type,
                FileName = backupFileName,
                FilePath = backupFilePath,
                SizeBytes = fileBytes.Length,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _masterContext.BackupHistories.Add(backupHistory);
            await _masterContext.SaveChangesAsync();

            return File(fileBytes, "application/sql", backupFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating database backup");
            return StatusCode(500, new { message = "Failed to create backup", error = ex.Message });
        }
    }

    private async Task<List<string>> GetTableNames(Npgsql.NpgsqlConnection connection)
    {
        var tables = new List<string>();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name";

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            tables.Add(reader.GetString(0));
        }

        return tables;
    }

    private async Task<string> GetCreateTableStatement(Npgsql.NpgsqlConnection connection, string tableName)
    {
        var sql = new StringBuilder();
        sql.AppendLine($"CREATE TABLE \"{tableName}\" (");

        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = @tableName
            ORDER BY ordinal_position";
        command.Parameters.AddWithValue("tableName", tableName);

        var columns = new List<string>();
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var columnName = reader.GetString(0);
            var dataType = reader.GetString(1);
            var maxLength = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2);
            var isNullable = reader.GetString(3) == "YES";
            var defaultValue = reader.IsDBNull(4) ? null : reader.GetString(4);

            var columnDef = $"    \"{columnName}\" {dataType.ToUpper()}";
            if (maxLength.HasValue && (dataType == "character varying" || dataType == "character"))
            {
                columnDef += $"({maxLength})";
            }
            if (!isNullable)
            {
                columnDef += " NOT NULL";
            }
            if (!string.IsNullOrEmpty(defaultValue))
            {
                columnDef += $" DEFAULT {defaultValue}";
            }
            columns.Add(columnDef);
        }

        sql.AppendLine(string.Join(",\n", columns));
        sql.AppendLine(");");

        return sql.ToString();
    }

    private async Task<string> GenerateInsertStatements(Npgsql.NpgsqlConnection connection, string tableName)
    {
        var sql = new StringBuilder();

        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT * FROM \"{tableName}\"";

        using var reader = await command.ExecuteReaderAsync();
        
        if (!reader.HasRows) return string.Empty;

        while (await reader.ReadAsync())
        {
            sql.Append($"INSERT INTO \"{tableName}\" (");
            
            var columns = new List<string>();
            var values = new List<string>();

            for (int i = 0; i < reader.FieldCount; i++)
            {
                columns.Add($"\"{reader.GetName(i)}\"");
                
                if (reader.IsDBNull(i))
                {
                    values.Add("NULL");
                }
                else
                {
                    var value = reader.GetValue(i);
                    var valueStr = value switch
                    {
                        bool b => b ? "TRUE" : "FALSE",
                        string s => $"'{s.Replace("'", "''")}'",
                        DateTime dt => $"'{dt:yyyy-MM-dd HH:mm:ss}'",
                        Guid g => $"'{g}'",
                        byte[] bytes => $"'\\x{BitConverter.ToString(bytes).Replace("-", "")}'",
                        _ => value.ToString()?.Replace("'", "''") ?? "NULL"
                    };
                    
                    if (value is not bool && value is not null && !decimal.TryParse(value.ToString(), out _))
                    {
                        valueStr = valueStr.StartsWith("'") ? valueStr : $"'{valueStr}'";
                    }
                    
                    values.Add(valueStr);
                }
            }

            sql.AppendLine($"{string.Join(", ", columns)}) VALUES ({string.Join(", ", values)});");
        }

        return sql.ToString();
    }

    [HttpGet("backup-history")]
    public async Task<ActionResult<IEnumerable<BackupHistoryDto>>> GetBackupHistory([FromQuery] string? databaseName = null)
    {
        try
        {
            var query = _masterContext.BackupHistories.AsQueryable();

            if (!string.IsNullOrEmpty(databaseName))
            {
                query = query.Where(b => b.DatabaseName == databaseName);
            }

            var backups = await query
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new BackupHistoryDto
                {
                    Id = b.Id,
                    DatabaseName = b.DatabaseName,
                    DatabaseType = b.DatabaseType,
                    FileName = b.FileName,
                    SizeBytes = b.SizeBytes,
                    CreatedAt = b.CreatedAt,
                    CreatedBy = b.CreatedBy
                })
                .ToListAsync();

            return Ok(backups);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting backup history");
            return StatusCode(500, new { message = "Failed to retrieve backup history", error = ex.Message });
        }
    }

    [HttpGet("download/{backupId}")]
    public async Task<IActionResult> DownloadBackup(Guid backupId)
    {
        try
        {
            var backup = await _masterContext.BackupHistories.FindAsync(backupId);
            if (backup == null)
            {
                return NotFound(new { message = "Backup not found" });
            }

            if (!System.IO.File.Exists(backup.FilePath))
            {
                return NotFound(new { message = "Backup file not found on disk" });
            }

            var fileBytes = await System.IO.File.ReadAllBytesAsync(backup.FilePath);
            return File(fileBytes, "application/sql", backup.FileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading backup");
            return StatusCode(500, new { message = "Failed to download backup", error = ex.Message });
        }
    }

    [HttpPost("restore")]
    public async Task<IActionResult> RestoreBackup([FromBody] RestoreRequest request)
    {
        try
        {
            var backup = await _masterContext.BackupHistories.FindAsync(request.BackupId);
            if (backup == null)
            {
                return NotFound(new { message = "Backup not found" });
            }

            if (!System.IO.File.Exists(backup.FilePath))
            {
                return NotFound(new { message = "Backup file not found on disk" });
            }

            // Read SQL backup file
            var sqlContent = await System.IO.File.ReadAllTextAsync(backup.FilePath);

            // Get connection string for the target database
            var connectionString = backup.DatabaseType == "master"
                ? _configuration.GetConnectionString("DefaultConnection")
                : GetWorkspaceConnectionString(backup.DatabaseName);

            // Execute SQL restore
            using var connection = new Npgsql.NpgsqlConnection(connectionString);
            await connection.OpenAsync();

            // Split SQL into individual statements and execute
            var statements = sqlContent.Split(new[] { ";\r\n", ";\n" }, StringSplitOptions.RemoveEmptyEntries);
            
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                foreach (var statement in statements)
                {
                    var trimmedStatement = statement.Trim();
                    if (string.IsNullOrWhiteSpace(trimmedStatement) || trimmedStatement.StartsWith("--"))
                        continue;

                    using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = trimmedStatement;
                    await command.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }

            return Ok(new { message = "Database restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring backup");
            return StatusCode(500, new { message = "Failed to restore backup", error = ex.Message });
        }
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(524288000)] // 500 MB
    [RequestFormLimits(MultipartBodyLengthLimit = 524288000)]
    public async Task<IActionResult> UploadBackup([FromForm] IFormFile file, [FromForm] string databaseName, [FromForm] string databaseType)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded" });
            }

            if (!file.FileName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Only .sql files are allowed" });
            }

            // Create backups directory if it doesn't exist
            var backupsDir = Path.Combine(Directory.GetCurrentDirectory(), "Backups");
            if (!Directory.Exists(backupsDir))
            {
                Directory.CreateDirectory(backupsDir);
            }

            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var fileName = $"{Path.GetFileNameWithoutExtension(file.FileName)}_{timestamp}.sql";
            var filePath = Path.Combine(backupsDir, fileName);

            // Save uploaded file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Save backup history to database
            var backupHistory = new Models.BackupHistory
            {
                DatabaseName = databaseName,
                DatabaseType = databaseType,
                FileName = fileName,
                FilePath = filePath,
                SizeBytes = file.Length,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _masterContext.BackupHistories.Add(backupHistory);
            await _masterContext.SaveChangesAsync();

            return Ok(new { 
                message = "Backup uploaded successfully",
                backupId = backupHistory.Id,
                fileName = fileName
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading backup");
            return StatusCode(500, new { message = "Failed to upload backup", error = ex.Message });
        }
    }

    [HttpDelete("delete/{backupId}")]
    public async Task<IActionResult> DeleteBackup(Guid backupId)
    {
        try
        {
            var backup = await _masterContext.BackupHistories.FindAsync(backupId);
            if (backup == null)
            {
                return NotFound(new { message = "Backup not found" });
            }

            // Delete file from disk
            if (System.IO.File.Exists(backup.FilePath))
            {
                System.IO.File.Delete(backup.FilePath);
            }

            // Delete from database
            _masterContext.BackupHistories.Remove(backup);
            await _masterContext.SaveChangesAsync();

            return Ok(new { message = "Backup deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting backup");
            return StatusCode(500, new { message = "Failed to delete backup", error = ex.Message });
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
    public string DatabaseType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}

public class RestoreRequest
{
    public Guid BackupId { get; set; }
}
