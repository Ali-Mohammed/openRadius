using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Backend.Services;
using System.Security.Claims;
using System.Text.Json;
using System.Text;
using Finbuckle.MultiTenant.Abstractions;

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
[Authorize]
public class DebeziumController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DebeziumController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IEdgeRuntimeScriptService _edgeRuntimeScriptService;
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;

    public DebeziumController(
        ApplicationDbContext context,
        IHttpClientFactory httpClientFactory,
        ILogger<DebeziumController> logger,
        IConfiguration configuration,
        IEdgeRuntimeScriptService edgeRuntimeScriptService,
        IMultiTenantContextAccessor<WorkspaceTenantInfo> tenantAccessor)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
        _edgeRuntimeScriptService = edgeRuntimeScriptService;
        _tenantAccessor = tenantAccessor;
    }

    // Settings endpoints
    [HttpGet("settings")]
    public async Task<ActionResult<DebeziumSettings>> GetSettings()
    {
        var settings = await _context.DebeziumSettings.FirstOrDefaultAsync(s => s.IsDefault);
        if (settings == null)
        {
            // Use configuration value if available, otherwise use localhost
            var defaultUrl = _configuration["Debezium:ConnectUrl"] ?? "http://localhost:8083";
            settings = new DebeziumSettings
            {
                ConnectUrl = defaultUrl,
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
        // Priority: DB settings > appsettings.json > default
        return settings?.ConnectUrl 
            ?? _configuration["Debezium:ConnectUrl"] 
            ?? "http://localhost:8083";
    }

    // Build the Debezium source connector config dictionary
    private Dictionary<string, object> BuildConnectorConfig(DebeziumConnector connector, string hostname)
    {
        return new Dictionary<string, object>
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
            { "snapshot.mode", connector.SnapshotMode },
            // Ensure schema is included in CDC messages for sink connector compatibility
            { "key.converter", "org.apache.kafka.connect.json.JsonConverter" },
            { "value.converter", "org.apache.kafka.connect.json.JsonConverter" },
            { "key.converter.schemas.enable", "true" },
            { "value.converter.schemas.enable", "true" }
        };
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

            var config = BuildConnectorConfig(connector, hostname);

            // Add any additional config from JSON
            if (!string.IsNullOrEmpty(connector.AdditionalConfig))
            {
                try
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
                catch (JsonException ex)
                {
                    return BadRequest(new { error = $"Invalid JSON in Additional Config: {ex.Message}" });
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

    // Sync connectors from Debezium to database
    [HttpPost("connectors/sync")]
    public async Task<ActionResult> SyncConnectors()
    {
        try
        {
            var debeziumUrl = await GetDebeziumUrl();
            var client = _httpClientFactory.CreateClient();

            // Get all connectors from Debezium
            var response = await client.GetAsync($"{debeziumUrl}/connectors?expand=info");
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { error = "Failed to fetch connectors from Debezium" });
            }

            var content = await response.Content.ReadAsStringAsync();
            var debeziumConnectors = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(content);

            int synced = 0;
            int skipped = 0;

            foreach (var kvp in debeziumConnectors ?? new Dictionary<string, JsonElement>())
            {
                var connectorName = kvp.Key;
                var connectorInfo = kvp.Value;

                // Check if connector already exists in database
                var existingConnector = await _context.DebeziumConnectors
                    .FirstOrDefaultAsync(c => c.Name == connectorName);

                if (existingConnector != null)
                {
                    skipped++;
                    continue;
                }

                // Extract config from Debezium response
                var config = connectorInfo.GetProperty("info").GetProperty("config");

                var newConnector = new DebeziumConnector
                {
                    Name = connectorName,
                    ConnectorClass = config.GetProperty("connector.class").GetString() ?? "",
                    DatabaseHostname = config.GetProperty("database.hostname").GetString() ?? "",
                    DatabasePort = int.TryParse(config.GetProperty("database.port").GetString(), out var port) ? port : 5432,
                    DatabaseUser = config.GetProperty("database.user").GetString() ?? "",
                    DatabasePassword = config.GetProperty("database.password").GetString() ?? "",
                    DatabaseName = config.GetProperty("database.dbname").GetString() ?? "",
                    DatabaseServerName = config.GetProperty("database.server.name").GetString() ?? "",
                    PluginName = config.GetProperty("plugin.name").GetString() ?? "pgoutput",
                    SlotName = config.GetProperty("slot.name").GetString() ?? "",
                    PublicationAutocreateMode = config.TryGetProperty("publication.autocreate.mode", out var pubMode) ? pubMode.GetString() ?? "filtered" : "filtered",
                    TableIncludeList = config.TryGetProperty("table.include.list", out var tables) ? tables.GetString() ?? "" : "",
                    SnapshotMode = config.TryGetProperty("snapshot.mode", out var snapshot) ? snapshot.GetString() ?? "initial" : "initial",
                    CreatedAt = DateTime.UtcNow,
                    Status = "RUNNING"
                };

                _context.DebeziumConnectors.Add(newConnector);
                synced++;
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = $"Synced {synced} connector(s), skipped {skipped} existing",
                synced,
                skipped
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing connectors");
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

            var config = BuildConnectorConfig(connector, hostname);

            // Add any additional config from JSON
            if (!string.IsNullOrEmpty(connector.AdditionalConfig))
            {
                try
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
                catch (JsonException ex)
                {
                    return BadRequest(new { error = $"Invalid JSON in Additional Config: {ex.Message}" });
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

    // ── Edge Runtime Install Script ──────────────────────────────────────────

    /// <summary>
    /// Generates a customized Edge Runtime installation script.
    /// When SaveToServer is true, persists the script and returns a public download URL.
    /// </summary>
    [HttpPost("edge-runtime/install-script")]
    public async Task<ActionResult<EdgeRuntimeInstallScriptResponse>> GenerateEdgeRuntimeScript(
        [FromBody] EdgeRuntimeInstallScriptRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.KafkaBootstrapServer))
                return BadRequest(new { error = "KafkaBootstrapServer is required." });

            if (string.IsNullOrWhiteSpace(request.Topics))
                return BadRequest(new { error = "Topics is required." });

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var createdBy = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value;
            var workspaceId = _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? 0;

            var result = await _edgeRuntimeScriptService.GenerateInstallScriptAsync(request, baseUrl, workspaceId, createdBy);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating Edge Runtime install script");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Lists all saved (non-deleted) Edge Runtime scripts.
    /// Returns summaries without full script content.
    /// </summary>
    [HttpGet("edge-runtime/scripts")]
    public async Task<ActionResult<List<EdgeRuntimeScriptSummaryDto>>> ListEdgeRuntimeScripts()
    {
        try
        {
            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var workspaceId = _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? 0;
            var scripts = await _edgeRuntimeScriptService.ListScriptsAsync(baseUrl, workspaceId);
            return Ok(scripts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing Edge Runtime scripts");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Public endpoint — serves a persisted Edge Runtime install script as plain text.
    /// No authentication required so it can be used with: curl -sSL {url} | sudo bash
    /// </summary>
    [HttpGet("edge-runtime/scripts/{uuid:guid}")]
    [AllowAnonymous]
    [Produces("text/plain")]
    public async Task<ActionResult> GetEdgeRuntimeScriptByUuid(Guid uuid)
    {
        try
        {
            var script = await _edgeRuntimeScriptService.GetScriptByUuidAsync(uuid);
            if (script == null)
                return NotFound("#!/usr/bin/env bash\necho \"Error: Install script not found or has been revoked.\"\nexit 1\n");

            return Content(script.ScriptContent, "text/plain; charset=utf-8");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Edge Runtime script {Uuid}", uuid);
            return StatusCode(500, $"#!/usr/bin/env bash\necho \"Error: {ex.Message}\"\nexit 1\n");
        }
    }

    /// <summary>
    /// Soft-deletes (revokes) a persisted Edge Runtime script by UUID.
    /// </summary>
    [HttpDelete("edge-runtime/scripts/{uuid:guid}")]
    public async Task<IActionResult> DeleteEdgeRuntimeScript(Guid uuid)
    {
        try
        {
            var deletedBy = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value;
            var workspaceId = _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? 0;
            var deleted = await _edgeRuntimeScriptService.DeleteScriptAsync(uuid, workspaceId, deletedBy);

            if (!deleted)
                return NotFound(new { error = "Script not found." });

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Edge Runtime script {Uuid}", uuid);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
