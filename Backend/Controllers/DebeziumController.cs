using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;
using System.Text;

namespace Backend.Controllers;

public class DatabaseConnectionTest
{
    public string ConnectorClass { get; set; } = string.Empty;
    public string DatabaseHostname { get; set; } = string.Empty;
    public int DatabasePort { get; set; }
    public string DatabaseUser { get; set; } = string.Empty;
    public string DatabasePassword { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class DebeziumController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DebeziumController> _logger;

    public DebeziumController(
        ApplicationDbContext context,
        IHttpClientFactory httpClientFactory,
        ILogger<DebeziumController> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    // Settings endpoints
    [HttpGet("settings")]
    public async Task<ActionResult<DebeziumSettings>> GetSettings()
    {
        var settings = await _context.DebeziumSettings.FirstOrDefaultAsync(s => s.IsDefault);
        if (settings == null)
        {
            settings = new DebeziumSettings
            {
                ConnectUrl = "http://localhost:8083",
                IsDefault = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.DebeziumSettings.Add(settings);
            await _context.SaveChangesAsync();
        }
        return Ok(settings);
    }

    [HttpPut("settings/{id}")]
    public async Task<IActionResult> UpdateSettings(int id, DebeziumSettings settings)
    {
        if (id != settings.Id)
            return BadRequest();

        settings.UpdatedAt = DateTime.UtcNow;
        _context.Entry(settings).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _context.DebeziumSettings.AnyAsync(e => e.Id == id))
                return NotFound();
            throw;
        }

        return NoContent();
    }

    [HttpPost("settings/test")]
    public async Task<ActionResult> TestConnection([FromBody] DebeziumSettings settings)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync($"{settings.ConnectUrl}/");
            
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return Ok(new { 
                    connected = true, 
                    message = "Successfully connected to Debezium Connect",
                    version = content 
                });
            }
            
            return StatusCode((int)response.StatusCode, new { 
                connected = false, 
                message = $"Failed to connect: {response.ReasonPhrase}" 
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { 
                connected = false, 
                message = $"Connection error: {ex.Message}" 
            });
        }
    }

    [HttpPost("test-connection")]
    public async Task<ActionResult> TestDatabaseConnection([FromBody] DatabaseConnectionTest connectionTest)
    {
        try
        {
            string connectionString;
            
            // Build connection string based on connector class
            if (connectionTest.ConnectorClass.Contains("PostgresConnector"))
            {
                connectionString = $"Host={connectionTest.DatabaseHostname};Port={connectionTest.DatabasePort};Database={connectionTest.DatabaseName};Username={connectionTest.DatabaseUser};Password={connectionTest.DatabasePassword};Timeout=5;";
                
                using (var connection = new Npgsql.NpgsqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    return Ok(new { 
                        connected = true, 
                        message = "Successfully connected to PostgreSQL database",
                        serverVersion = connection.ServerVersion
                    });
                }
            }
            else if (connectionTest.ConnectorClass.Contains("MySqlConnector"))
            {
                connectionString = $"Server={connectionTest.DatabaseHostname};Port={connectionTest.DatabasePort};Database={connectionTest.DatabaseName};Uid={connectionTest.DatabaseUser};Pwd={connectionTest.DatabasePassword};ConnectionTimeout=5;";
                
                using (var connection = new MySql.Data.MySqlClient.MySqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    return Ok(new { 
                        connected = true, 
                        message = "Successfully connected to MySQL database",
                        serverVersion = connection.ServerVersion
                    });
                }
            }
            else
            {
                return BadRequest(new { 
                    connected = false, 
                    message = "Unsupported connector type. Only PostgreSQL and MySQL are supported for connection testing." 
                });
            }
        }
        catch (Exception ex)
        {
            return Ok(new { 
                connected = false, 
                message = $"Connection failed: {ex.Message}"
            });
        }
    }

    [HttpPost("get-tables")]
    public async Task<ActionResult> GetDatabaseTables([FromBody] DatabaseConnectionTest connectionTest)
    {
        try
        {
            var tables = new List<string>();
            
            if (connectionTest.ConnectorClass.Contains("PostgresConnector"))
            {
                var connectionString = $"Host={connectionTest.DatabaseHostname};Port={connectionTest.DatabasePort};Database={connectionTest.DatabaseName};Username={connectionTest.DatabaseUser};Password={connectionTest.DatabasePassword};Timeout=5;";
                
                using (var connection = new Npgsql.NpgsqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    var command = connection.CreateCommand();
                    command.CommandText = @"
                        SELECT table_schema || '.' || table_name as full_table_name
                        FROM information_schema.tables
                        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                        AND table_type = 'BASE TABLE'
                        ORDER BY table_schema, table_name";
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            tables.Add(reader.GetString(0));
                        }
                    }
                }
            }
            else if (connectionTest.ConnectorClass.Contains("MySqlConnector"))
            {
                var connectionString = $"Server={connectionTest.DatabaseHostname};Port={connectionTest.DatabasePort};Database={connectionTest.DatabaseName};Uid={connectionTest.DatabaseUser};Pwd={connectionTest.DatabasePassword};ConnectionTimeout=5;";
                
                using (var connection = new MySql.Data.MySqlClient.MySqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    var command = connection.CreateCommand();
                    command.CommandText = @"
                        SELECT CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as full_table_name
                        FROM information_schema.tables
                        WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME";
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            tables.Add(reader.GetString(0));
                        }
                    }
                }
            }
            else
            {
                return BadRequest(new { 
                    error = "Unsupported connector type. Only PostgreSQL and MySQL are supported." 
                });
            }

            return Ok(new { tables });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { 
                error = $"Failed to fetch tables: {ex.Message}"
            });
        }
    }


    // Get Debezium Connect URL
    private async Task<string> GetDebeziumUrl()
    {
        var settings = await _context.DebeziumSettings.FirstOrDefaultAsync(s => s.IsDefault);
        return settings?.ConnectUrl ?? "http://localhost:8083";
    }

    // Connector endpoints - List all connectors
    [HttpGet("connectors")]
    public async Task<ActionResult> GetConnectors()
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync($"{debeziumUrl}/connectors?expand=status");
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, await response.Content.ReadAsStringAsync());
            }

            var content = await response.Content.ReadAsStringAsync();
            var connectors = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(content);

            // Also get local database connectors
            var dbConnectors = await _context.DebeziumConnectors.ToListAsync();

            return Ok(new { debezium = connectors, database = dbConnectors });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching connectors");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Get single connector
    [HttpGet("connectors/{name}")]
    public async Task<ActionResult> GetConnector(string name)
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();
            
            // Get from Debezium
            var response = await client.GetAsync($"{debeziumUrl}/connectors/{name}?expand=status");
            
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, await response.Content.ReadAsStringAsync());
            }

            var content = await response.Content.ReadAsStringAsync();
            
            // Get from database
            var dbConnector = await _context.DebeziumConnectors.FirstOrDefaultAsync(c => c.Name == name);

            return Ok(new { debezium = JsonSerializer.Deserialize<JsonElement>(content), database = dbConnector });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching connector {Name}", name);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Create connector
    [HttpPost("connectors")]
    public async Task<ActionResult> CreateConnector(DebeziumConnector connector)
    {
        try
        {
            // Validate and normalize slot name
            if (string.IsNullOrWhiteSpace(connector.SlotName))
            {
                // Auto-generate slot name: only lowercase, digits, underscores, max 63 chars
                connector.SlotName = connector.Name
                    .ToLower()
                    .Replace("-", "_")
                    .Replace(" ", "_")
                    .Substring(0, Math.Min(50, connector.Name.Length)) + "_slot";
                connector.SlotName = System.Text.RegularExpressions.Regex.Replace(connector.SlotName, "[^a-z0-9_]", "_");
            }
            else
            {
                // Normalize to lowercase and validate
                connector.SlotName = connector.SlotName.ToLower();
                
                if (connector.SlotName.Length > 63)
                {
                    return BadRequest(new { error = "Slot name must be 63 characters or less" });
                }
                
                if (!System.Text.RegularExpressions.Regex.IsMatch(connector.SlotName, "^[a-z0-9_]+$"))
                {
                    return BadRequest(new { error = "Slot name must contain only lowercase letters, digits, and underscores" });
                }
            }

            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();

            // Convert localhost/127.0.0.1 to Docker service name for Debezium (running in container)
            var hostname = connector.DatabaseHostname;
            if (hostname == "localhost" || hostname == "127.0.0.1")
            {
                hostname = "openradius-postgres";
            }

            // Build Debezium connector config
            var config = new Dictionary<string, object>
            {
                { "connector.class", connector.ConnectorClass },
                { "database.hostname", hostname },
                { "database.port", connector.DatabasePort.ToString() },
                { "database.user", connector.DatabaseUser },
                { "database.password", connector.DatabasePassword },
                { "database.dbname", connector.DatabaseName },
                { "database.server.name", connector.DatabaseServerName },
                { "topic.prefix", connector.DatabaseServerName },
                { "plugin.name", connector.PluginName },
                { "slot.name", connector.SlotName },
                { "publication.autocreate.mode", connector.PublicationAutocreateMode },
                { "table.include.list", connector.TableIncludeList },
                { "snapshot.mode", connector.SnapshotMode }
            };

            // Add any additional config from JSON
            if (!string.IsNullOrEmpty(connector.AdditionalConfig))
            {
                var additionalConfig = JsonSerializer.Deserialize<Dictionary<string, object>>(connector.AdditionalConfig);
                if (additionalConfig != null)
                {
                    foreach (var kvp in additionalConfig)
                    {
                        config[kvp.Key] = kvp.Value;
                    }
                }
            }

            var payload = new
            {
                name = connector.Name,
                config
            };

            var jsonContent = JsonSerializer.Serialize(payload);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{debeziumUrl}/connectors", httpContent);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = errorContent });
            }

            // Save to database
            connector.CreatedAt = DateTime.UtcNow;
            connector.Status = "RUNNING";
            _context.DebeziumConnectors.Add(connector);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetConnector), new { name = connector.Name }, connector);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating connector");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Update connector
    [HttpPut("connectors/{name}")]
    public async Task<IActionResult> UpdateConnector(string name, DebeziumConnector connector)
    {
        if (name != connector.Name)
            return BadRequest();

        try
        {
            // Validate and normalize slot name
            if (string.IsNullOrWhiteSpace(connector.SlotName))
            {
                // Auto-generate slot name: only lowercase, digits, underscores, max 63 chars
                connector.SlotName = connector.Name
                    .ToLower()
                    .Replace("-", "_")
                    .Replace(" ", "_")
                    .Substring(0, Math.Min(50, connector.Name.Length)) + "_slot";
                connector.SlotName = System.Text.RegularExpressions.Regex.Replace(connector.SlotName, "[^a-z0-9_]", "_");
            }
            else
            {
                // Normalize to lowercase and validate
                connector.SlotName = connector.SlotName.ToLower();
                
                if (connector.SlotName.Length > 63)
                {
                    return BadRequest(new { error = "Slot name must be 63 characters or less" });
                }
                
                if (!System.Text.RegularExpressions.Regex.IsMatch(connector.SlotName, "^[a-z0-9_]+$"))
                {
                    return BadRequest(new { error = "Slot name must contain only lowercase letters, digits, and underscores" });
                }
            }

            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();

            // Convert localhost/127.0.0.1 to Docker service name for Debezium (running in container)
            var hostname = connector.DatabaseHostname;
            if (hostname == "localhost" || hostname == "127.0.0.1")
            {
                hostname = "openradius-postgres";
            }

            // Build Debezium connector config
            var config = new Dictionary<string, object>
            {
                { "connector.class", connector.ConnectorClass },
                { "database.hostname", hostname },
                { "database.port", connector.DatabasePort.ToString() },
                { "database.user", connector.DatabaseUser },
                { "database.password", connector.DatabasePassword },
                { "database.dbname", connector.DatabaseName },
                { "database.server.name", connector.DatabaseServerName },
                { "topic.prefix", connector.DatabaseServerName },
                { "plugin.name", connector.PluginName },
                { "slot.name", connector.SlotName },
                { "publication.autocreate.mode", connector.PublicationAutocreateMode },
                { "table.include.list", connector.TableIncludeList },
                { "snapshot.mode", connector.SnapshotMode }
            };

            // Add any additional config
            if (!string.IsNullOrEmpty(connector.AdditionalConfig))
            {
                var additionalConfig = JsonSerializer.Deserialize<Dictionary<string, object>>(connector.AdditionalConfig);
                if (additionalConfig != null)
                {
                    foreach (var kvp in additionalConfig)
                    {
                        config[kvp.Key] = kvp.Value;
                    }
                }
            }

            var jsonContent = JsonSerializer.Serialize(config);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await client.PutAsync($"{debeziumUrl}/connectors/{name}/config", httpContent);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = errorContent });
            }

            // Update in database
            var dbConnector = await _context.DebeziumConnectors.FirstOrDefaultAsync(c => c.Name == name);
            if (dbConnector != null)
            {
                dbConnector.ConnectorClass = connector.ConnectorClass;
                dbConnector.DatabaseHostname = connector.DatabaseHostname;
                dbConnector.DatabasePort = connector.DatabasePort;
                dbConnector.DatabaseUser = connector.DatabaseUser;
                dbConnector.DatabasePassword = connector.DatabasePassword;
                dbConnector.DatabaseName = connector.DatabaseName;
                dbConnector.DatabaseServerName = connector.DatabaseServerName;
                dbConnector.PluginName = connector.PluginName;
                dbConnector.SlotName = connector.SlotName;
                dbConnector.PublicationAutocreateMode = connector.PublicationAutocreateMode;
                dbConnector.TableIncludeList = connector.TableIncludeList;
                dbConnector.SnapshotMode = connector.SnapshotMode;
                dbConnector.AdditionalConfig = connector.AdditionalConfig;
                dbConnector.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating connector {Name}", name);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Delete connector
    [HttpDelete("connectors/{name}")]
    public async Task<IActionResult> DeleteConnector(string name)
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();

            var response = await client.DeleteAsync($"{debeziumUrl}/connectors/{name}");
            
            if (!response.IsSuccessStatusCode && response.StatusCode != System.Net.HttpStatusCode.NotFound)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = errorContent });
            }

            // Delete from database
            var dbConnector = await _context.DebeziumConnectors.FirstOrDefaultAsync(c => c.Name == name);
            if (dbConnector != null)
            {
                _context.DebeziumConnectors.Remove(dbConnector);
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting connector {Name}", name);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Pause connector
    [HttpPut("connectors/{name}/pause")]
    public async Task<IActionResult> PauseConnector(string name)
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();
            var response = await client.PutAsync($"{debeziumUrl}/connectors/{name}/pause", null);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = errorContent });
            }

            // Update status in database
            var dbConnector = await _context.DebeziumConnectors.FirstOrDefaultAsync(c => c.Name == name);
            if (dbConnector != null)
            {
                dbConnector.Status = "PAUSED";
                dbConnector.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing connector {Name}", name);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Resume connector
    [HttpPut("connectors/{name}/resume")]
    public async Task<IActionResult> ResumeConnector(string name)
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();
            var response = await client.PutAsync($"{debeziumUrl}/connectors/{name}/resume", null);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = errorContent });
            }

            // Update status in database
            var dbConnector = await _context.DebeziumConnectors.FirstOrDefaultAsync(c => c.Name == name);
            if (dbConnector != null)
            {
                dbConnector.Status = "RUNNING";
                dbConnector.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming connector {Name}", name);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Restart connector
    [HttpPost("connectors/{name}/restart")]
    public async Task<IActionResult> RestartConnector(string name)
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();
            var response = await client.PostAsync($"{debeziumUrl}/connectors/{name}/restart", null);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = errorContent });
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restarting connector {Name}", name);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
