using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

/// <summary>
/// Custom tenant store that loads tenant information from the master database
/// based on Instant records.
/// </summary>
public class InstantTenantStore : IMultiTenantStore<InstantTenantInfo>
{
    private readonly MasterDbContext _masterDbContext;
    private readonly IConfiguration _configuration;

    public InstantTenantStore(MasterDbContext masterDbContext, IConfiguration configuration)
    {
        _masterDbContext = masterDbContext;
        _configuration = configuration;
    }

    public async Task<InstantTenantInfo?> GetAsync(string id)
    {
        var instant = await _masterDbContext.Instants
            .FirstOrDefaultAsync(i => i.Id.ToString() == id && i.DeletedAt == null);
        
        return instant != null ? MapToTenantInfo(instant) : null;
    }

    public async Task<IEnumerable<InstantTenantInfo>> GetAllAsync(int skip = 0, int take = 100)
    {
        var instants = await _masterDbContext.Instants
            .Where(i => i.DeletedAt == null)
            .Skip(skip)
            .Take(take)
            .ToListAsync();
        
        return instants.Select(MapToTenantInfo);
    }

    public async Task<IEnumerable<InstantTenantInfo>> GetAllAsync()
    {
        var instants = await _masterDbContext.Instants
            .Where(i => i.DeletedAt == null)
            .ToListAsync();
        
        return instants.Select(MapToTenantInfo);
    }

    public async Task<InstantTenantInfo?> GetByIdentifierAsync(string identifier)
    {
        var instant = await _masterDbContext.Instants
            .FirstOrDefaultAsync(i => i.Name == identifier && i.DeletedAt == null);
        
        return instant != null ? MapToTenantInfo(instant) : null;
    }

    public async Task<bool> AddAsync(InstantTenantInfo tenantInfo)
    {
        // This would be handled through the Instant creation endpoint
        await Task.CompletedTask;
        return false;
    }

    public async Task<bool> RemoveAsync(string identifier)
    {
        // This would be handled through the Instant deletion endpoint
        await Task.CompletedTask;
        return false;
    }

    public async Task<bool> UpdateAsync(InstantTenantInfo tenantInfo)
    {
        // This would be handled through the Instant update endpoint
        await Task.CompletedTask;
        return false;
    }

    private InstantTenantInfo MapToTenantInfo(Instant instant)
    {
        // Generate a unique connection string for each instant/tenant
        var baseConnectionString = _configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        
        // Create a unique database name for each instant
        var tenantConnectionString = baseConnectionString.Replace(
            GetDatabaseName(baseConnectionString), 
            $"openradius_instant_{instant.Id}"
        );

        return new InstantTenantInfo
        {
            Id = instant.Id.ToString(),
            Identifier = instant.Name,
            Name = instant.Title,
            ConnectionString = tenantConnectionString,
            InstantId = instant.Id,
            DisplayName = instant.Title,
            Location = instant.Location,
            IsActive = instant.Status == "active"
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
