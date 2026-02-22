using Npgsql;

namespace RadiusSyncService.Services;

/// <summary>
/// Queries the EdgeRunner PostgreSQL database for table row counts.
/// Results are cached for a configurable TTL to avoid hammering the DB on every dashboard refresh.
/// </summary>
public class EdgeDatabaseService
{
    private readonly string? _connectionString;
    private readonly ILogger<EdgeDatabaseService> _logger;
    private readonly TimeSpan _cacheTtl = TimeSpan.FromSeconds(30);

    private DatabaseStats? _cached;
    private DateTime _cacheExpiry = DateTime.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);

    // Tables to monitor — matches the tables synced by the JDBC sink connector
    private static readonly string[] MonitoredTables =
    [
        "RadiusNasDevices",
        "RadiusUsers",
        "RadiusProfiles",
        "RadiusIpReservations",
        "RadiusCustomAttributes",
        "radius_ip_pools"
    ];

    public EdgeDatabaseService(IConfiguration configuration, ILogger<EdgeDatabaseService> logger)
    {
        _connectionString = configuration["EdgeDatabase:ConnectionString"];
        _logger = logger;
    }

    /// <summary>
    /// Returns cached DB stats, refreshing from the database if the cache has expired.
    /// </summary>
    public async Task<DatabaseStats> GetTableStatsAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && _cached != null && DateTime.UtcNow < _cacheExpiry)
            return _cached;

        await _lock.WaitAsync();
        try
        {
            // Re-check inside lock
            if (!forceRefresh && _cached != null && DateTime.UtcNow < _cacheExpiry)
                return _cached;

            var result = await FetchStatsAsync();
            _cached = result;
            _cacheExpiry = DateTime.UtcNow + _cacheTtl;
            return result;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<DatabaseStats> FetchStatsAsync()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            return new DatabaseStats
            {
                Reachable = false,
                Error = "EdgeDatabase:ConnectionString is not configured.",
                Tables = [],
                FetchedAt = DateTime.UtcNow
            };
        }

        var tables = new List<TableRowCount>();

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            foreach (var table in MonitoredTables)
            {
                try
                {
                    // Use a quoted identifier to handle mixed-case table names
                    var sql = $"SELECT COUNT(*) FROM \"{table}\"";
                    await using var cmd = new NpgsqlCommand(sql, conn);
                    var count = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                    tables.Add(new TableRowCount(table, count));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to query row count for table {Table}", table);
                    tables.Add(new TableRowCount(table, -1, ex.Message));
                }
            }

            return new DatabaseStats
            {
                Reachable = true,
                Tables = tables,
                FetchedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to EdgeRunner database");
            return new DatabaseStats
            {
                Reachable = false,
                Error = ex.Message,
                Tables = tables,
                FetchedAt = DateTime.UtcNow
            };
        }
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

public class DatabaseStats
{
    public bool Reachable { get; init; }
    public string? Error { get; init; }
    public List<TableRowCount> Tables { get; init; } = [];
    public DateTime FetchedAt { get; init; }
    public long TotalRows => Tables.Where(t => t.RowCount >= 0).Sum(t => t.RowCount);
}

public record TableRowCount(string TableName, long RowCount, string? Error = null);
