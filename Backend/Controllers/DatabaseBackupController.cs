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
