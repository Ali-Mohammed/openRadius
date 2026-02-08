using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/cdc")]
[Authorize]
public class CdcMonitorController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<CdcMonitorController> _logger;
    private readonly IServiceProvider _serviceProvider;

    public CdcMonitorController(
        IHttpClientFactory httpClientFactory,
        ILogger<CdcMonitorController> logger,
        IServiceProvider serviceProvider)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    // Get all Kafka topics dynamically from database connectors
    [HttpGet("topics")]
    public async Task<ActionResult> GetTopics()
    {
        try
        {
            var topics = new List<string>();
            
            using var scope = _serviceProvider.CreateScope();
            
            // Get all workspace databases and their connectors
            var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
            var workspaces = await masterContext.Workspaces.ToListAsync();
            
            foreach (var workspace in workspaces)
            {
                try
                {
                    // Create connection string for this workspace
                    var connectionString = $"Host=localhost;Port=5432;Database=openradius_workspace_{workspace.Id};Username=admin;Password=admin123";
                    
                    var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
                    optionsBuilder.UseNpgsql(connectionString);
                    
                    using var appContext = new ApplicationDbContext(optionsBuilder.Options);
                    
                    // Get all connectors for this workspace
                    var connectors = await appContext.DebeziumConnectors.ToListAsync();
                    
                    foreach (var connector in connectors)
                    {
                        // Build topic name from connector configuration
                        // Format: {database.server.name}.{schema}.{table}
                        if (!string.IsNullOrEmpty(connector.TableIncludeList))
                        {
                            var tables = connector.TableIncludeList.Split(',', StringSplitOptions.RemoveEmptyEntries);
                            foreach (var table in tables)
                            {
                                var tableName = table.Trim().Replace("public.", "");
                                var topic = $"{connector.DatabaseServerName}.public.{tableName}";
                                if (!topics.Contains(topic))
                                {
                                    topics.Add(topic);
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"Could not load connectors for workspace {workspace.Id}");
                }
            }

            return Ok(new { topics = topics.ToArray() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Kafka topics from database");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // Get topic details
    [HttpGet("topics/{topicName}")]
    public async Task<ActionResult> GetTopicDetails(string topicName)
    {
        try
        {
            // Return basic topic information
            // In production, this could query Kafka for partition count, offset info, etc.
            return Ok(new
            {
                name = topicName,
                partitions = 1,
                status = "active"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching topic details for {TopicName}", topicName);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
