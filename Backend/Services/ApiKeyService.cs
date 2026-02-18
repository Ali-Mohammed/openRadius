using System.Security.Cryptography;
using System.Text;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Backend.Services;

/// <summary>
/// Service for API key lifecycle management (CRUD) and authentication validation.
/// Keys are workspace-scoped and stored in the MasterDbContext.
/// </summary>
public interface IApiKeyService
{
    /// <summary>Create a new API key — returns the raw key (shown once).</summary>
    Task<ApiKeyCreatedDto> CreateAsync(CreateApiKeyRequest request, int workspaceId, int createdBy);

    /// <summary>List API keys for a workspace with pagination.</summary>
    Task<ApiKeyPagedResponse> ListAsync(int workspaceId, int page = 1, int pageSize = 25, string? search = null);

    /// <summary>Get a single API key by UUID.</summary>
    Task<ApiKeyDto?> GetByUuidAsync(Guid uuid, int workspaceId);

    /// <summary>Update an existing API key.</summary>
    Task<ApiKeyDto?> UpdateAsync(Guid uuid, UpdateApiKeyRequest request, int workspaceId, int updatedBy);

    /// <summary>Soft-delete an API key.</summary>
    Task<bool> DeleteAsync(Guid uuid, int workspaceId, int deletedBy);

    /// <summary>Validate a raw API key and return the resolved key entity (or null).</summary>
    Task<ApiKey?> ValidateKeyAsync(string rawKey);

    /// <summary>Record that a key was used (updates LastUsedAt / LastUsedIp).</summary>
    Task RecordUsageAsync(int keyId, string? ipAddress);

    /// <summary>Get available scopes.</summary>
    List<ApiKeyScopeInfo> GetAvailableScopes();
}

public class ApiKeyService : IApiKeyService
{
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<ApiKeyService> _logger;

    // Key format: "or_" prefix + 48 random URL-safe characters
    private const string KeyPrefix = "or_";
    private const int RawKeyLength = 48;

    public ApiKeyService(MasterDbContext masterContext, ILogger<ApiKeyService> logger)
    {
        _masterContext = masterContext;
        _logger = logger;
    }

    public async Task<ApiKeyCreatedDto> CreateAsync(CreateApiKeyRequest request, int workspaceId, int createdBy)
    {
        // Generate a cryptographically secure random key
        var rawKey = GenerateRawKey();
        var hash = HashKey(rawKey);
        var prefix = rawKey[..Math.Min(12, rawKey.Length)];

        // Validate scopes
        var scopes = request.Scopes?.Where(ApiKeyScopes.IsValid).ToList() ?? new List<string>();

        var entity = new ApiKey
        {
            Name = request.Name.Trim(),
            KeyPrefix = prefix,
            KeyHash = hash,
            Scopes = scopes.Count > 0 ? string.Join(",", scopes) : null,
            ExpiresAt = request.ExpiresAt?.ToUniversalTime(),
            IsActive = true,
            WorkspaceId = workspaceId,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _masterContext.ApiKeys.Add(entity);
        await _masterContext.SaveChangesAsync();

        _logger.LogInformation("API key created: {Name} (UUID={Uuid}) for workspace {WorkspaceId} by user {CreatedBy}",
            entity.Name, entity.Uuid, workspaceId, createdBy);

        return new ApiKeyCreatedDto
        {
            Uuid = entity.Uuid,
            Name = entity.Name,
            KeyPrefix = entity.KeyPrefix,
            Key = rawKey,
            Scopes = scopes,
            ExpiresAt = entity.ExpiresAt,
            IsActive = entity.IsActive,
            CreatedAt = entity.CreatedAt,
        };
    }

    public async Task<ApiKeyPagedResponse> ListAsync(int workspaceId, int page = 1, int pageSize = 25, string? search = null)
    {
        var query = _masterContext.ApiKeys
            .Where(k => k.WorkspaceId == workspaceId && !k.IsDeleted)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(k =>
                k.Name.ToLower().Contains(term) ||
                k.KeyPrefix.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var items = await query
            .OrderByDescending(k => k.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(k => MapToDto(k))
            .ToListAsync();

        return new ApiKeyPagedResponse
        {
            Data = items,
            CurrentPage = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
        };
    }

    public async Task<ApiKeyDto?> GetByUuidAsync(Guid uuid, int workspaceId)
    {
        var entity = await _masterContext.ApiKeys
            .FirstOrDefaultAsync(k => k.Uuid == uuid && k.WorkspaceId == workspaceId && !k.IsDeleted);

        return entity == null ? null : MapToDto(entity);
    }

    public async Task<ApiKeyDto?> UpdateAsync(Guid uuid, UpdateApiKeyRequest request, int workspaceId, int updatedBy)
    {
        var entity = await _masterContext.ApiKeys
            .FirstOrDefaultAsync(k => k.Uuid == uuid && k.WorkspaceId == workspaceId && !k.IsDeleted);

        if (entity == null) return null;

        if (request.Name != null)
            entity.Name = request.Name.Trim();

        if (request.Scopes != null)
        {
            var validScopes = request.Scopes.Where(ApiKeyScopes.IsValid).ToList();
            entity.Scopes = validScopes.Count > 0 ? string.Join(",", validScopes) : null;
        }

        if (request.ExpiresAt.HasValue)
            entity.ExpiresAt = request.ExpiresAt.Value.ToUniversalTime();

        if (request.IsActive.HasValue)
            entity.IsActive = request.IsActive.Value;

        entity.UpdatedAt = DateTime.UtcNow;
        entity.UpdatedBy = updatedBy;

        await _masterContext.SaveChangesAsync();

        _logger.LogInformation("API key updated: {Uuid} in workspace {WorkspaceId} by user {UpdatedBy}",
            uuid, workspaceId, updatedBy);

        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid uuid, int workspaceId, int deletedBy)
    {
        var entity = await _masterContext.ApiKeys
            .FirstOrDefaultAsync(k => k.Uuid == uuid && k.WorkspaceId == workspaceId && !k.IsDeleted);

        if (entity == null) return false;

        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        entity.DeletedBy = deletedBy;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        entity.UpdatedBy = deletedBy;

        await _masterContext.SaveChangesAsync();

        _logger.LogInformation("API key deleted: {Uuid} in workspace {WorkspaceId} by user {DeletedBy}",
            uuid, workspaceId, deletedBy);

        return true;
    }

    public async Task<ApiKey?> ValidateKeyAsync(string rawKey)
    {
        if (string.IsNullOrWhiteSpace(rawKey))
            return null;

        var hash = HashKey(rawKey);
        var prefix = rawKey[..Math.Min(12, rawKey.Length)];

        // Look up by prefix first (indexed), then verify hash
        var candidate = await _masterContext.ApiKeys
            .FirstOrDefaultAsync(k =>
                k.KeyPrefix == prefix &&
                k.KeyHash == hash &&
                k.IsActive &&
                !k.IsDeleted);

        if (candidate == null)
            return null;

        // Check expiration
        if (candidate.ExpiresAt.HasValue && candidate.ExpiresAt.Value < DateTime.UtcNow)
        {
            _logger.LogWarning("API key {Uuid} is expired (expired at {ExpiresAt})", candidate.Uuid, candidate.ExpiresAt);
            return null;
        }

        return candidate;
    }

    public async Task RecordUsageAsync(int keyId, string? ipAddress)
    {
        var entity = await _masterContext.ApiKeys.FindAsync(keyId);
        if (entity == null) return;

        entity.LastUsedAt = DateTime.UtcNow;
        entity.LastUsedIp = ipAddress;
        await _masterContext.SaveChangesAsync();
    }

    public List<ApiKeyScopeInfo> GetAvailableScopes() => ApiKeyScopes.All;

    // ═════════════════════════════════════════════════════════════════════
    //  Private helpers
    // ═════════════════════════════════════════════════════════════════════

    private static string GenerateRawKey()
    {
        var bytes = RandomNumberGenerator.GetBytes(36); // 36 bytes → 48 base64url chars
        var base64 = Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
        return $"{KeyPrefix}{base64}";
    }

    private static string HashKey(string rawKey)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawKey));
        return Convert.ToHexStringLower(bytes);
    }

    private static ApiKeyDto MapToDto(ApiKey entity)
    {
        return new ApiKeyDto
        {
            Uuid = entity.Uuid,
            Name = entity.Name,
            KeyPrefix = entity.KeyPrefix,
            Scopes = string.IsNullOrEmpty(entity.Scopes)
                ? new List<string>()
                : entity.Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
            ExpiresAt = entity.ExpiresAt,
            LastUsedAt = entity.LastUsedAt,
            LastUsedIp = entity.LastUsedIp,
            IsActive = entity.IsActive,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
        };
    }
}
