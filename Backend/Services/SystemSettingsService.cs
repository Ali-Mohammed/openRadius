using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Backend.Services;

public class SystemSettingsService : ISystemSettingsService
{
    private readonly MasterDbContext _masterContext;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SystemSettingsService> _logger;

    private const string CachePrefix = "SystemSetting:";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public SystemSettingsService(
        MasterDbContext masterContext,
        IMemoryCache cache,
        ILogger<SystemSettingsService> logger)
    {
        _masterContext = masterContext;
        _cache = cache;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<string?> GetSettingValueAsync(string key)
    {
        var cacheKey = $"{CachePrefix}{key}";

        if (_cache.TryGetValue(cacheKey, out string? cachedValue))
        {
            return cachedValue;
        }

        var value = await _masterContext.SystemSettings
            .AsNoTracking()
            .Where(s => s.Key == key && !s.IsDeleted)
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        if (value != null)
        {
            _cache.Set(cacheKey, value, CacheDuration);
        }

        return value;
    }

    /// <inheritdoc />
    public async Task<bool> GetBoolSettingAsync(string key, bool defaultValue = false)
    {
        var value = await GetSettingValueAsync(key);
        if (value == null) return defaultValue;
        return bool.TryParse(value, out var result) ? result : defaultValue;
    }

    /// <inheritdoc />
    public async Task<SystemSettingDto?> GetSettingAsync(string key)
    {
        var setting = await _masterContext.SystemSettings
            .AsNoTracking()
            .Include(s => s.UpdatedByUser)
            .Where(s => s.Key == key && !s.IsDeleted)
            .FirstOrDefaultAsync();

        return setting == null ? null : MapToDto(setting);
    }

    /// <inheritdoc />
    public async Task<SwaggerSettingResponseDto> GetSwaggerSettingAsync()
    {
        var setting = await _masterContext.SystemSettings
            .AsNoTracking()
            .Include(s => s.UpdatedByUser)
            .Where(s => s.Key == SystemSettingKeys.SwaggerEnabled && !s.IsDeleted)
            .FirstOrDefaultAsync();

        if (setting == null)
        {
            return new SwaggerSettingResponseDto
            {
                Enabled = false,
                UpdatedAt = DateTime.UtcNow,
            };
        }

        return new SwaggerSettingResponseDto
        {
            Enabled = bool.TryParse(setting.Value, out var val) && val,
            UpdatedAt = setting.UpdatedAt,
            UpdatedByEmail = setting.UpdatedByUser?.Email,
        };
    }

    /// <inheritdoc />
    public async Task UpdateSettingAsync(string key, string value, int userId, string? description = null, string? category = null)
    {
        var setting = await _masterContext.SystemSettings
            .FirstOrDefaultAsync(s => s.Key == key && !s.IsDeleted);

        if (setting == null)
        {
            setting = new SystemSetting
            {
                Key = key,
                Value = value,
                Description = description,
                Category = category ?? "General",
                CreatedBy = userId,
                UpdatedBy = userId,
            };
            _masterContext.SystemSettings.Add(setting);
            _logger.LogInformation("User {UserId} created system setting {Key} = {Value}", userId, key, value);
        }
        else
        {
            if (!setting.IsEditable)
            {
                _logger.LogWarning("User {UserId} attempted to modify non-editable setting {Key}", userId, key);
                throw new InvalidOperationException($"Setting '{key}' is not editable at runtime.");
            }

            setting.Value = value;
            setting.UpdatedAt = DateTime.UtcNow;
            setting.UpdatedBy = userId;
            if (description != null) setting.Description = description;
            if (category != null) setting.Category = category;
            _logger.LogInformation("User {UserId} updated system setting {Key} from previous value to {Value}", userId, key, value);
        }

        await _masterContext.SaveChangesAsync();

        // Invalidate cache immediately
        _cache.Remove($"{CachePrefix}{key}");
    }

    /// <inheritdoc />
    public async Task<List<SystemSettingDto>> GetSettingsByCategoryAsync(string category)
    {
        var settings = await _masterContext.SystemSettings
            .AsNoTracking()
            .Include(s => s.UpdatedByUser)
            .Where(s => s.Category == category && !s.IsDeleted)
            .OrderBy(s => s.Key)
            .ToListAsync();

        return settings.Select(MapToDto).ToList();
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private static SystemSettingDto MapToDto(SystemSetting s) => new()
    {
        Uuid = s.Uuid,
        Key = s.Key,
        Value = s.Value,
        Description = s.Description,
        Category = s.Category,
        DataType = s.DataType,
        IsEditable = s.IsEditable,
        UpdatedAt = s.UpdatedAt,
        UpdatedByEmail = s.UpdatedByUser?.Email,
    };
}
