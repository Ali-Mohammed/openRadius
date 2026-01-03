using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Backend.Services;

/// <summary>
/// Custom tenant store that loads tenant information from the master database
/// based on Workspace records with in-memory caching.
/// </summary>
public class WorkspaceTenantStore : IMultiTenantStore<WorkspaceTenantInfo>
{
    private readonly MasterDbContext _masterDbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WorkspaceTenantStore> _logger;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public WorkspaceTenantStore(MasterDbContext masterDbContext, IConfiguration configuration, ILogger<WorkspaceTenantStore> logger, IMemoryCache cache)
    {
        _masterDbContext = masterDbContext;
        _configuration = configuration;
        _logger = logger;
        _cache = cache;
    }

    public async Task<WorkspaceTenantInfo?> GetAsync(string id)
    {
        var cacheKey = $"tenant_{id}";
        
        if (_cache.TryGetValue(cacheKey, out WorkspaceTenantInfo? cachedTenant))
        {
            _logger.LogInformation($"WorkspaceTenantStore.GetAsync - Cache HIT for id: {id}");
            return cachedTenant;
        }
        
        _logger.LogInformation($"WorkspaceTenantStore.GetAsync - Cache MISS for id: {id}, querying database");
        var workspace = await _masterDbContext.Workspaces
            .FirstOrDefaultAsync(i => i.Id.ToString() == id && i.DeletedAt == null);
        
        var result = workspace != null ? MapToTenantInfo(workspace) : null;
        
        // Cache the result for 30 minutes
        if (result != null)
        {
            _cache.Set(cacheKey, result, CacheDuration);
            _logger.LogInformation($"WorkspaceTenantStore.GetAsync - Cached tenant for id: {id}");
        }
        
        _logger.LogInformation($"WorkspaceTenantStore.GetAsync returned: WorkspaceId={result?.WorkspaceId}, ConnectionString={result?.ConnectionString}");
        return result;
    }

    public async Task<IEnumerable<WorkspaceTenantInfo>> GetAllAsync(int skip = 0, int take = 100)
    {
        var workspaces = await _masterDbContext.Workspaces
            .Where(i => i.DeletedAt == null)
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        
        return workspaces.Select(MapToTenantInfo);
    }

    public async Task<IEnumerable<WorkspaceTenantInfo>> GetAllAsync()
    {
        var workspaces = await _masterDbContext.Workspaces
            .Where(i => i.DeletedAt == null)
            .ToListAsync();
        
        return workspaces.Select(MapToTenantInfo);
    }

    public async Task<WorkspaceTenantInfo?> GetByIdentifierAsync(string identifier)
    {
        var cacheKey = $"tenant_identifier_{identifier}";
        
        if (_cache.TryGetValue(cacheKey, out WorkspaceTenantInfo? cachedTenant))
        {
            _logger.LogInformation($"WorkspaceTenantStore.GetByIdentifierAsync - Cache HIT for identifier: {identifier}");
            return cachedTenant;
        }
        
        _logger.LogInformation($"WorkspaceTenantStore.GetByIdentifierAsync - Cache MISS for identifier: {identifier}, querying database");
        
        // Try to parse as integer ID first, otherwise treat as workspace name
        Workspace? workspace = null;
        if (int.TryParse(identifier, out int workspaceId))
        {
            workspace = await _masterDbContext.Workspaces
                .FirstOrDefaultAsync(i => i.Id == workspaceId && i.DeletedAt == null);
        }
        
        // Fallback to searching by name if not found by ID
        if (workspace == null)
        {
            workspace = await _masterDbContext.Workspaces
                .FirstOrDefaultAsync(i => i.Name == identifier && i.DeletedAt == null);
        }
        
        var result = workspace != null ? MapToTenantInfo(workspace) : null;
        
        // Cache the result for 30 minutes
        if (result != null)
        {
            _cache.Set(cacheKey, result, CacheDuration);
            _logger.LogInformation($"WorkspaceTenantStore.GetByIdentifierAsync - Cached tenant for identifier: {identifier}");
        }
        
        _logger.LogInformation($"WorkspaceTenantStore.GetByIdentifierAsync returned: WorkspaceId={result?.WorkspaceId}, ConnectionString={result?.ConnectionString}");
        return result;
    }

    public async Task<bool> AddAsync(WorkspaceTenantInfo tenantInfo)
    {
        // This would be handled through the Workspace creation endpoint
        await Task.CompletedTask;
        return false;
    }

    public async Task<bool> RemoveAsync(string identifier)
    {
        // This would be handled through the Workspace deletion endpoint
        await Task.CompletedTask;
        return false;
    }

    public async Task<bool> UpdateAsync(WorkspaceTenantInfo tenantInfo)
    {
        // This would be handled through the Workspace update endpoint
        await Task.CompletedTask;
        return false;
    }

    private WorkspaceTenantInfo MapToTenantInfo(Workspace workspace)
    {
        // Generate a unique connection string for each workspace/tenant
        var baseConnectionString = _configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        
        // Create a unique database name for each workspace
        var tenantConnectionString = baseConnectionString.Replace(
            GetDatabaseName(baseConnectionString), 
            $"openradius_workspace_{workspace.Id}"
        );

        return new WorkspaceTenantInfo
        {
            Id = workspace.Id.ToString(),
            Identifier = workspace.Name,
            Name = workspace.Title,
            ConnectionString = tenantConnectionString,
            WorkspaceId = workspace.Id,
            DisplayName = workspace.Title,
            Location = workspace.Location,
            IsActive = workspace.Status == "active"
        };
    }

    private string GetDatabaseName(string connectionString)
    {
        // Extract database name from PostgreSQL connection string
        var parts = connectionString.Split(';');
        foreach (var part in parts)
        {
            if (part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase))
            {
                return part.Split('=')[1].Trim();
            }
        }
        return "openradius";
    }
}


