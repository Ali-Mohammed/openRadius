using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;

namespace Backend.Models;

/// <summary>
/// Custom TenantInfo for Instant-based multi-tenancy.
/// Adds ConnectionString and additional Instant-specific properties.
/// </summary>
public record InstantTenantInfo : TenantInfo
{
    public InstantTenantInfo() : base(string.Empty, string.Empty)
    {
    }
    
    public string? ConnectionString { get; init; }
    public int InstantId { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string Location { get; init; } = string.Empty;
    public bool IsActive { get; init; } = true;
}
