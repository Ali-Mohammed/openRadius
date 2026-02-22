using Npgsql;

namespace RadiusSyncService.Services;

/// <summary>
/// Queries the EdgeRunner PostgreSQL database for table row counts and CDC activity.
/// Results are cached to avoid hammering the DB on every dashboard refresh.
/// </summary>
public class EdgeDatabaseService
{
    private readonly string? _connectionString;
    private readonly ILogger<EdgeDatabaseService> _logger;
    private readonly TimeSpan _statsCacheTtl = TimeSpan.FromSeconds(30);
    private readonly TimeSpan _cdcCacheTtl = TimeSpan.FromSeconds(15);

    private DatabaseStats? _cachedStats;
    private DateTime _statsCacheExpiry = DateTime.MinValue;

    private CdcActivity? _cachedCdc;
    private DateTime _cdcCacheExpiry = DateTime.MinValue;

    private readonly SemaphoreSlim _statsLock = new(1, 1);
    private readonly SemaphoreSlim _cdcLock = new(1, 1);

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

    // Per-table config for CDC activity queries
    private static readonly (string Table, string IdCol, bool HasIsDeleted, bool NullableUpdatedAt)[] ActivityTables =
    [
        ("RadiusNasDevices",     "Shortname",      false, false),
        ("RadiusUsers",          "Username",        true,  false),
        ("RadiusProfiles",       "Name",            true,  false),
        ("RadiusIpReservations", "IpAddress",       false, true),
        ("RadiusCustomAttributes","AttributeName",  true,  false),
    ];

    public EdgeDatabaseService(IConfiguration configuration, ILogger<EdgeDatabaseService> logger)
    {
        _connectionString = configuration["EdgeDatabase:ConnectionString"];
        _logger = logger;
    }

    // =========================================================================
    // Table row counts
    // =========================================================================

    public async Task<DatabaseStats> GetTableStatsAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && _cachedStats != null && DateTime.UtcNow < _statsCacheExpiry)
            return _cachedStats;

        await _statsLock.WaitAsync();
        try
        {
            if (!forceRefresh && _cachedStats != null && DateTime.UtcNow < _statsCacheExpiry)
                return _cachedStats;

            var result = await FetchStatsAsync();
            _cachedStats = result;
            _statsCacheExpiry = DateTime.UtcNow + _statsCacheTtl;
            return result;
        }
        finally
        {
            _statsLock.Release();
        }
    }

    private async Task<DatabaseStats> FetchStatsAsync()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
            return new DatabaseStats { Reachable = false, Error = "EdgeDatabase:ConnectionString is not configured.", Tables = [], FetchedAt = DateTime.UtcNow };

        var tables = new List<TableRowCount>();
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            foreach (var table in MonitoredTables)
            {
                try
                {
                    await using var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{table}\"", conn);
                    var count = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                    tables.Add(new TableRowCount(table, count));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to query row count for table {Table}", table);
                    tables.Add(new TableRowCount(table, -1, ex.Message));
                }
            }

            return new DatabaseStats { Reachable = true, Tables = tables, FetchedAt = DateTime.UtcNow };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to EdgeRunner database");
            return new DatabaseStats { Reachable = false, Error = ex.Message, Tables = tables, FetchedAt = DateTime.UtcNow };
        }
    }

    // =========================================================================
    // CDC activity feed
    // =========================================================================

    public async Task<CdcActivity> GetCdcActivityAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && _cachedCdc != null && DateTime.UtcNow < _cdcCacheExpiry)
            return _cachedCdc;

        await _cdcLock.WaitAsync();
        try
        {
            if (!forceRefresh && _cachedCdc != null && DateTime.UtcNow < _cdcCacheExpiry)
                return _cachedCdc;

            var result = await FetchCdcActivityAsync();
            _cachedCdc = result;
            _cdcCacheExpiry = DateTime.UtcNow + _cdcCacheTtl;
            return result;
        }
        finally
        {
            _cdcLock.Release();
        }
    }

    private async Task<CdcActivity> FetchCdcActivityAsync()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
            return new CdcActivity { Reachable = false, Error = "EdgeDatabase:ConnectionString is not configured.", FetchedAt = DateTime.UtcNow };

        var events = new List<CdcEvent>();
        var tableSyncInfos = new List<TableSyncInfo>();

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            foreach (var (table, idCol, hasIsDeleted, nullableUpdatedAt) in ActivityTables)
            {
                try
                {
                    var tsExpr = nullableUpdatedAt
                        ? $"COALESCE(\"UpdatedAt\", \"CreatedAt\")"
                        : "\"UpdatedAt\"";
                    var isDeletedExpr = hasIsDeleted ? "COALESCE(\"IsDeleted\", false)" : "false";

                    var sql = $"""
                        SELECT
                            "{idCol}"  AS identifier,
                            {tsExpr}   AS updated_at,
                            "CreatedAt" AS created_at,
                            {isDeletedExpr} AS is_deleted
                        FROM "{table}"
                        ORDER BY {tsExpr} DESC
                        LIMIT 10
                        """;

                    await using var cmd = new NpgsqlCommand(sql, conn);
                    await using var reader = await cmd.ExecuteReaderAsync();

                    DateTime? maxTs = null;
                    while (await reader.ReadAsync())
                    {
                        var identifier = reader.IsDBNull(0) ? "(unknown)" : reader.GetString(0);
                        var updatedAt  = reader.IsDBNull(1) ? DateTime.UtcNow : reader.GetDateTime(1);
                        var createdAt  = reader.IsDBNull(2) ? updatedAt : reader.GetDateTime(2);
                        var isDeleted  = !reader.IsDBNull(3) && reader.GetBoolean(3);

                        if (maxTs == null || updatedAt > maxTs) maxTs = updatedAt;

                        var operation = isDeleted
                            ? "Deleted"
                            : (updatedAt - createdAt).TotalMinutes < 1 ? "Created" : "Updated";

                        events.Add(new CdcEvent(table, identifier, operation, updatedAt));
                    }

                    tableSyncInfos.Add(new TableSyncInfo(table, maxTs));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to query CDC activity for {Table}", table);
                    tableSyncInfos.Add(new TableSyncInfo(table, null, ex.Message));
                }
            }

            // Sort all events newest-first, keep top 50
            events.Sort((a, b) => b.Timestamp.CompareTo(a.Timestamp));
            if (events.Count > 50) events = events[..50];

            return new CdcActivity
            {
                Reachable = true,
                TableSyncInfo = tableSyncInfos,
                RecentEvents = events,
                FetchedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch CDC activity from EdgeRunner database");
            return new CdcActivity { Reachable = false, Error = ex.Message, FetchedAt = DateTime.UtcNow };
        }
    }
}

// ---------------------------------------------------------------------------
// DTOs — row counts
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

// ---------------------------------------------------------------------------
// DTOs — CDC activity
// ---------------------------------------------------------------------------

public class CdcActivity
{
    public bool Reachable { get; init; }
    public string? Error { get; init; }
    public List<TableSyncInfo> TableSyncInfo { get; init; } = [];
    public List<CdcEvent> RecentEvents { get; init; } = [];
    public DateTime FetchedAt { get; init; }
}

public record TableSyncInfo(string TableName, DateTime? LastUpdated, string? Error = null);

public record CdcEvent(string TableName, string Identifier, string Operation, DateTime Timestamp);

