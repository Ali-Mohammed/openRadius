using Backend.DTOs;

namespace Backend.Services;

/// <summary>
/// Service for managing system-wide configuration settings.
/// Provides caching, audit tracking, and type-safe accessors.
/// </summary>
public interface ISystemSettingsService
{
    /// <summary>
    /// Gets a raw setting value by key. Returns null if the key doesn't exist.
    /// Result is cached for performance.
    /// </summary>
    Task<string?> GetSettingValueAsync(string key);

    /// <summary>
    /// Gets a boolean system setting. Returns <paramref name="defaultValue"/> if the key doesn't exist.
    /// Result is cached for performance.
    /// </summary>
    Task<bool> GetBoolSettingAsync(string key, bool defaultValue = false);

    /// <summary>
    /// Gets a full setting DTO with metadata (audit trail, description, etc.).
    /// </summary>
    Task<SystemSettingDto?> GetSettingAsync(string key);

    /// <summary>
    /// Gets the Swagger setting DTO with enriched audit information.
    /// </summary>
    Task<SwaggerSettingResponseDto> GetSwaggerSettingAsync();

    /// <summary>
    /// Updates (or creates) a system setting value with full audit trail.
    /// Throws <see cref="InvalidOperationException"/> if the setting is marked non-editable.
    /// </summary>
    Task UpdateSettingAsync(string key, string value, int userId, string? description = null, string? category = null);

    /// <summary>
    /// Gets all settings in a category with full metadata.
    /// </summary>
    Task<List<SystemSettingDto>> GetSettingsByCategoryAsync(string category);
}
