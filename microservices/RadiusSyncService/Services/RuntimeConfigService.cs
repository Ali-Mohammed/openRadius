using System.Text.Json;

namespace RadiusSyncService.Services;

/// <summary>
/// Represents the mutable runtime portion of SignalR configuration.
/// </summary>
public sealed class SignalRRuntimeConfig
{
    public string HubUrl { get; set; } = string.Empty;
    public string? BaseUrl { get; set; }
    public string? HubPath { get; set; }

    /// <summary>
    /// Derive BaseUrl and HubPath from HubUrl when saving.
    /// </summary>
    public void DecomposeUrl()
    {
        if (Uri.TryCreate(HubUrl, UriKind.Absolute, out var uri))
        {
            BaseUrl  = uri.GetLeftPart(UriPartial.Authority); // e.g. http://localhost:5000
            HubPath  = uri.PathAndQuery;                      // e.g. /hubs/microservices
        }
        else
        {
            BaseUrl = null;
            HubPath = null;
        }
    }
}

/// <summary>
/// Full persisted runtime config file schema.
/// Merges with appsettings.json — values here take precedence at runtime.
/// </summary>
public sealed class RuntimeConfigFile
{
    public SignalRRuntimeConfig SignalR { get; set; } = new();
    public DateTime LastModifiedUtc { get; set; }
    public string? LastModifiedBy { get; set; }
}

/// <summary>
/// Enterprise runtime configuration service.
/// Persists mutable settings (e.g. Hub URL) to a JSON override file so they
/// survive service restarts without touching appsettings.json.
/// </summary>
public sealed class RuntimeConfigService
{
    private readonly ILogger<RuntimeConfigService> _logger;
    private readonly string _filePath;
    private readonly string _defaultHubUrl;
    private RuntimeConfigFile _current;
    private readonly SemaphoreSlim _lock = new(1, 1);

    /// <summary>
    /// Fired when the SignalR Hub URL is changed. The subscriber (SignalRConnectionService)
    /// should tear down the current connection and reconnect to the new URL.
    /// </summary>
    public event Action<string>? HubUrlChanged;

    public RuntimeConfigService(
        ILogger<RuntimeConfigService> logger,
        IConfiguration configuration)
    {
        _logger = logger;

        // Persist next to the binary (or override via env RUNTIME_CONFIG_PATH)
        _filePath = Environment.GetEnvironmentVariable("RUNTIME_CONFIG_PATH")
                    ?? Path.Combine(AppContext.BaseDirectory, "runtime-config.json");

        // Seed from appsettings.json as the fallback default
        _defaultHubUrl = configuration["SignalR:HubUrl"]
                         ?? "http://localhost:5000/hubs/microservices";

        _current = LoadOrCreate();
    }

    // -------------------------------------------------------------------------
    // Public accessors
    // -------------------------------------------------------------------------

    /// <summary>The current effective Hub URL (persisted override or appsettings default).</summary>
    public string GetHubUrl() => _current.SignalR.HubUrl;

    /// <summary>Full snapshot of SignalR runtime config.</summary>
    public SignalRRuntimeConfig GetSignalRConfig() => _current.SignalR;

    /// <summary>Full snapshot of the persisted config file.</summary>
    public RuntimeConfigFile GetConfig() => _current;

    // -------------------------------------------------------------------------
    // Mutations
    // -------------------------------------------------------------------------

    /// <summary>
    /// Validate, persist and broadcast a new Hub URL.
    /// Throws <see cref="ArgumentException"/> if the URL is invalid.
    /// </summary>
    public async Task UpdateHubUrlAsync(string newUrl, string? changedBy = null)
    {
        if (!Uri.TryCreate(newUrl.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != "http" && uri.Scheme != "https"))
        {
            throw new ArgumentException(
                "Hub URL must be an absolute http or https URI (e.g. http://host:5000/hubs/name).",
                nameof(newUrl));
        }

        var normalised = uri.ToString().TrimEnd('/');

        await _lock.WaitAsync();
        try
        {
            _current.SignalR.HubUrl   = normalised;
            _current.SignalR.BaseUrl  = uri.GetLeftPart(UriPartial.Authority);
            _current.SignalR.HubPath  = uri.PathAndQuery;
            _current.LastModifiedUtc  = DateTime.UtcNow;
            _current.LastModifiedBy   = changedBy ?? "dashboard";

            await PersistAsync(_current);

            _logger.LogInformation(
                "SignalR Hub URL updated to {Url} by {By}", normalised, _current.LastModifiedBy);
        }
        finally
        {
            _lock.Release();
        }

        // Fire outside the lock to avoid dead-lock if subscriber is slow
        HubUrlChanged?.Invoke(normalised);
    }

    // -------------------------------------------------------------------------
    // Persistence helpers
    // -------------------------------------------------------------------------

    private RuntimeConfigFile LoadOrCreate()
    {
        try
        {
            if (File.Exists(_filePath))
            {
                var json = File.ReadAllText(_filePath);
                var loaded = JsonSerializer.Deserialize<RuntimeConfigFile>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (loaded is not null && !string.IsNullOrWhiteSpace(loaded.SignalR?.HubUrl))
                {
                    _logger.LogInformation(
                        "Loaded runtime config from {Path}  HubUrl={Url}",
                        _filePath, loaded.SignalR.HubUrl);
                    return loaded;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read runtime config from {Path} — using defaults", _filePath);
        }

        // Bootstrap from appsettings default
        var cfg = new RuntimeConfigFile
        {
            SignalR = new SignalRRuntimeConfig { HubUrl = _defaultHubUrl },
            LastModifiedUtc = DateTime.UtcNow,
            LastModifiedBy = "init"
        };
        cfg.SignalR.DecomposeUrl();
        return cfg;
    }

    private async Task PersistAsync(RuntimeConfigFile cfg)
    {
        try
        {
            var json = JsonSerializer.Serialize(cfg, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var dir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            // Atomic write via temp file + rename
            var tmp = _filePath + ".tmp";
            await File.WriteAllTextAsync(tmp, json);
            File.Move(tmp, _filePath, overwrite: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist runtime config to {Path}", _filePath);
            throw;
        }
    }
}
