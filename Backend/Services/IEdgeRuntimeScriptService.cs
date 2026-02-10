using Backend.DTOs;
using Backend.Models;

namespace Backend.Services;

/// <summary>
/// Service for generating and managing Edge Runtime installation scripts.
/// Generates customized, self-contained bash scripts that deploy
/// a local PostgreSQL + Debezium Connect stack on edge servers.
/// Optionally persists scripts to the database for public URL access.
/// </summary>
public interface IEdgeRuntimeScriptService
{
    /// <summary>
    /// Generates a customized Edge Runtime install script based on the provided parameters.
    /// If SaveToServer is true, persists the script and returns a public download URL.
    /// </summary>
    /// <param name="request">The script configuration parameters.</param>
    /// <param name="baseUrl">The base URL of the API for building public download links.</param>
    /// <param name="workspaceId">The workspace (tenant) ID that owns this script.</param>
    /// <param name="createdBy">The user who generated the script (for audit trail).</param>
    /// <returns>The install script response with the generated script, metadata, and optional public URL.</returns>
    Task<EdgeRuntimeInstallScriptResponse> GenerateInstallScriptAsync(
        EdgeRuntimeInstallScriptRequest request,
        string baseUrl,
        int workspaceId,
        string? createdBy = null);

    /// <summary>
    /// Retrieves a persisted script by its public UUID.
    /// Also increments the download counter.
    /// </summary>
    Task<EdgeRuntimeScript?> GetScriptByUuidAsync(Guid uuid);

    /// <summary>
    /// Lists all saved (non-deleted) scripts for a specific workspace as summary DTOs.
    /// </summary>
    Task<List<EdgeRuntimeScriptSummaryDto>> ListScriptsAsync(string baseUrl, int workspaceId);

    /// <summary>
    /// Soft-deletes a persisted script by UUID, scoped to the specified workspace.
    /// </summary>
    Task<bool> DeleteScriptAsync(Guid uuid, int workspaceId, string? deletedBy = null);
}
