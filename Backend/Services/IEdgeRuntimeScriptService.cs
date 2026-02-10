using Backend.DTOs;

namespace Backend.Services;

/// <summary>
/// Service for generating Edge Runtime installation scripts.
/// Generates customized, self-contained bash scripts that deploy
/// a local PostgreSQL + Debezium Connect stack on edge servers.
/// </summary>
public interface IEdgeRuntimeScriptService
{
    /// <summary>
    /// Generates a customized Edge Runtime install script based on the provided parameters.
    /// </summary>
    /// <param name="request">The script configuration parameters.</param>
    /// <returns>The install script response with the generated script and metadata.</returns>
    EdgeRuntimeInstallScriptResponse GenerateInstallScript(EdgeRuntimeInstallScriptRequest request);
}
