using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;

namespace Backend.Models;

/// <summary>
/// Custom TenantInfo for Workspace-based multi-tenancy.
/// Adds ConnectionString and additional Workspace-specific properties.
/// </summary>
public record WorkspaceTenantInfo : TenantInfo
{
    public WorkspaceTenantInfo() : base(string.Empty, string.Empty)
    {
    }
    
    public string? ConnectionString { get; init; }
    public int WorkspaceId { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string Location { get; init; } = string.Empty;
    public bool IsActive { get; init; } = true;
}


