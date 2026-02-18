namespace Backend.DTOs;

// ═══════════════════════════════════════════════════════════════════════
//  API Key DTOs — Management (Keycloak-authenticated)
// ═══════════════════════════════════════════════════════════════════════

/// <summary>Response DTO returned for API key list / detail endpoints.</summary>
public class ApiKeyDto
{
    public Guid Uuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new();
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public string? LastUsedIp { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Response returned only at creation time — includes the raw key (shown once).</summary>
public class ApiKeyCreatedDto
{
    public Guid Uuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;

    /// <summary>The full raw API key. Only returned once at creation — never stored or retrievable again.</summary>
    public string Key { get; set; } = string.Empty;

    public List<string> Scopes { get; set; } = new();
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Request body to create a new API key.</summary>
public class CreateApiKeyRequest
{
    /// <summary>Friendly display name (e.g. "CRM Integration").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Scopes to grant (e.g. ["radius.users.read"]). Empty = all scopes.</summary>
    public List<string>? Scopes { get; set; }

    /// <summary>Optional expiration date (UTC). Null = never expires.</summary>
    public DateTime? ExpiresAt { get; set; }
}

/// <summary>Request body to update an existing API key.</summary>
public class UpdateApiKeyRequest
{
    public string? Name { get; set; }
    public List<string>? Scopes { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>Paginated list of API keys.</summary>
public class ApiKeyPagedResponse
{
    public List<ApiKeyDto> Data { get; set; } = new();
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

// ═══════════════════════════════════════════════════════════════════════
//  External API DTOs — for API-key-authenticated consumers
// ═══════════════════════════════════════════════════════════════════════

/// <summary>DTO for RADIUS user data returned by the external API. Exposes UUIDs only.</summary>
public class ExternalRadiusUserDto
{
    public Guid Uuid { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Firstname { get; set; }
    public string? Lastname { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Company { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? ContractId { get; set; }
    public string? StaticIp { get; set; }
    public bool Enabled { get; set; }
    public decimal Balance { get; set; }
    public decimal LoanBalance { get; set; }
    public DateTime? Expiration { get; set; }
    public DateTime? LastOnline { get; set; }
    public string? OnlineStatus { get; set; }
    public int? RemainingDays { get; set; }
    public string? ProfileName { get; set; }
    public string? GroupName { get; set; }
    public string? ZoneName { get; set; }
    public List<string> Tags { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Paginated response for the external RADIUS users endpoint.</summary>
public class ExternalRadiusUserPagedResponse
{
    public List<ExternalRadiusUserDto> Data { get; set; } = new();
    public int Page { get; set; }
    public int Limit { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

/// <summary>Available scopes for API keys.</summary>
public static class ApiKeyScopes
{
    public const string RadiusUsersRead = "radius.users.read";
    public const string RadiusUsersWrite = "radius.users.write";

    public static readonly List<ApiKeyScopeInfo> All = new()
    {
        new(RadiusUsersRead, "Read RADIUS Users", "List and view RADIUS user details"),
        new(RadiusUsersWrite, "Write RADIUS Users", "Create and update RADIUS users"),
    };

    public static bool IsValid(string scope) =>
        All.Any(s => s.Key == scope);
}

public record ApiKeyScopeInfo(string Key, string Label, string Description);
