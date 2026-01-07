using Confluent.Kafka;
using Microsoft.AspNetCore.SignalR;
using Backend.Hubs;
using Backend.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Backend.Services;

public class KafkaConsumerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<KafkaConsumerService> _logger;
    private readonly IConfiguration _configuration;

    public KafkaConsumerService(
        IServiceProvider serviceProvider,
        ILogger<KafkaConsumerService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    private async Task<List<string>> GetTopicsFromConnectorsAsync()
    {
        var topics = new List<string>();
        
        try
        {
            using var scope = _serviceProvider.CreateScope();
            
            // Get all workspace databases and their connectors
            var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
            var workspaces = masterContext.Workspaces.ToList();
            
            foreach (var workspace in workspaces)
            {
                try
                {
                    // Create connection string for this workspace
                    var connectionString = $"Host=localhost;Port=5432;Database=openradius_workspace_{workspace.Id};Username=admin;Password=admin123";
                    
                    var optionsBuilder = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<ApplicationDbContext>();
                    optionsBuilder.UseNpgsql(connectionString);
                    
                    using var appContext = new ApplicationDbContext(optionsBuilder.Options);
                    
                    // Get all connectors for this workspace
                    var connectors = appContext.DebeziumConnectors.ToList();
                    
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
            
            if (topics.Count == 0)
            {
                _logger.LogWarning("No topics found from connectors. Create connectors to enable CDC monitoring.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading topics from database");
        }
        
        return topics;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Kafka Consumer Service starting...");

        // Dynamically load topics from database connectors
        var topics = await GetTopicsFromConnectorsAsync();
        
        if (topics.Count == 0)
        {
            _logger.LogWarning("No topics to monitor. Kafka Consumer Service stopping.");
            return;
        }

        var config = new ConsumerConfig
        {
            GroupId = "cdc-monitor-group",
            BootstrapServers = _configuration["Kafka:BootstrapServers"] ?? "localhost:9092",
            AutoOffsetReset = AutoOffsetReset.Latest,
            EnableAutoCommit = true,
            SessionTimeoutMs = 6000,
        };

        using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();
        
        try
        {
            consumer.Subscribe(topics);
            _logger.LogInformation($"Subscribed to {topics.Count} topics: {string.Join(", ", topics)}");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var consumeResult = consumer.Consume(TimeSpan.FromMilliseconds(1000));
                    
                    if (consumeResult != null)
                    {
                        await ProcessMessage(consumeResult);
                    }
                }
                catch (ConsumeException ex)
                {
                    _logger.LogError(ex, "Error consuming message");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Kafka consumer");
        }
        finally
        {
            consumer.Close();
        }
    }

    private async Task ProcessMessage(ConsumeResult<Ignore, string> result)
    {
        try
        {
            var message = result.Message.Value;
            var topic = result.Topic;

            _logger.LogInformation($"Received message from topic: {topic}");

            // Parse Debezium CDC event
            var cdcEvent = ParseDebeziumEvent(message, topic);
            
            if (cdcEvent != null)
            {
                // Send to SignalR clients subscribed to this topic
                using var scope = _serviceProvider.CreateScope();
                var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<CdcHub>>();
                
                await hubContext.Clients.Group(topic).SendAsync("ReceiveCdcEvent", cdcEvent);
                _logger.LogInformation($"Sent CDC event to SignalR clients for topic: {topic}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Kafka message");
        }
    }

    private object? ParseDebeziumEvent(string message, string topic)
    {
        try
        {
            var jsonDoc = JsonDocument.Parse(message);
            var payload = jsonDoc.RootElement.GetProperty("payload");

            var operation = payload.TryGetProperty("op", out var opElement) 
                ? opElement.GetString() 
                : null;

            var operationMap = new Dictionary<string, string>
            {
                { "c", "INSERT" },
                { "u", "UPDATE" },
                { "d", "DELETE" },
                { "r", "READ" }
            };

            var before = payload.TryGetProperty("before", out var beforeElement) && beforeElement.ValueKind != JsonValueKind.Null
                ? JsonSerializer.Deserialize<object>(beforeElement.GetRawText())
                : null;

            var after = payload.TryGetProperty("after", out var afterElement) && afterElement.ValueKind != JsonValueKind.Null
                ? JsonSerializer.Deserialize<object>(afterElement.GetRawText())
                : null;

            var source = payload.TryGetProperty("source", out var sourceElement)
                ? JsonSerializer.Deserialize<object>(sourceElement.GetRawText())
                : null;

            return new
            {
                id = Guid.NewGuid().ToString(),
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                operation = operation != null && operationMap.ContainsKey(operation) 
                    ? operationMap[operation] 
                    : "UNKNOWN",
                topic,
                table = topic.Split('.').LastOrDefault() ?? "",
                before,
                after,
                source
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing Debezium event");
            return null;
        }
    }
}
