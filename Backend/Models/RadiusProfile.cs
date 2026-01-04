using System.Text.Json.Serialization;

namespace Backend.Models;

// API Response Models for SAS Profile endpoint
public class SasProfileApiResponse
{
    [JsonPropertyName("current_page")]
    public int CurrentPage { get; set; }

    [JsonPropertyName("data")]
    public List<SasProfileData> Data { get; set; } = new();

    [JsonPropertyName("first_page_url")]
    public string? FirstPageUrl { get; set; }

    [JsonPropertyName("from")]
    public int From { get; set; }

    [JsonPropertyName("last_page")]
    public int LastPage { get; set; }

    [JsonPropertyName("last_page_url")]
    public string? LastPageUrl { get; set; }

    [JsonPropertyName("next_page_url")]
    public string? NextPageUrl { get; set; }

    [JsonPropertyName("path")]
    public string? Path { get; set; }

    [JsonPropertyName("per_page")]
    public int PerPage { get; set; }

    [JsonPropertyName("prev_page_url")]
    public string? PrevPageUrl { get; set; }

    [JsonPropertyName("to")]
    public int To { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public class SasProfileData
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("enabled")]
    public int Enabled { get; set; }

    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("downrate")]
    public int Downrate { get; set; }

    [JsonPropertyName("uprate")]
    public int Uprate { get; set; }

    [JsonPropertyName("pool")]
    public string? Pool { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("monthly")]
    public int Monthly { get; set; }

    [JsonPropertyName("burst_enabled")]
    public int BurstEnabled { get; set; }

    [JsonPropertyName("limit_expiration")]
    public int LimitExpiration { get; set; }

    [JsonPropertyName("expiration_amount")]
    public int ExpirationAmount { get; set; }

    [JsonPropertyName("expiration_unit")]
    public int ExpirationUnit { get; set; }

    [JsonPropertyName("site_id")]
    public int? SiteId { get; set; }

    [JsonPropertyName("online_users_count")]
    public int OnlineUsersCount { get; set; }

    [JsonPropertyName("users_count")]
    public int UsersCount { get; set; }

    [JsonPropertyName("site_details")]
    public object? SiteDetails { get; set; }
}

// Database Entity
public class RadiusProfile
{
    public int Id { get; set; }
    public int ExternalId { get; set; }
    public required string Name { get; set; }
    public bool Enabled { get; set; }
    public int Type { get; set; }
    public int Downrate { get; set; }
    public int Uprate { get; set; }
    public string? Pool { get; set; }
    public decimal Price { get; set; }
    public int Monthly { get; set; }
    public bool BurstEnabled { get; set; }
    public bool LimitExpiration { get; set; }
    public int ExpirationAmount { get; set; }
    public int ExpirationUnit { get; set; }
    public int? SiteId { get; set; }
    public int OnlineUsersCount { get; set; }
    public int UsersCount { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Package";
    public int WorkspaceId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime LastSyncedAt { get; set; }
}

// Response Models for API
public class RadiusProfileResponse
{
    public int Id { get; set; }
    public int ExternalId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public int Type { get; set; }
    public int Downrate { get; set; }
    public int Uprate { get; set; }
    public string? Pool { get; set; }
    public decimal Price { get; set; }
    public int Monthly { get; set; }
    public bool BurstEnabled { get; set; }
    public bool LimitExpiration { get; set; }
    public int ExpirationAmount { get; set; }
    public int ExpirationUnit { get; set; }
    public int? SiteId { get; set; }
    public int OnlineUsersCount { get; set; }
    public int UsersCount { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Package";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime LastSyncedAt { get; set; }
}

public class SyncProfileResponse
{
    public required string SyncId { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int TotalProfiles { get; set; }
    public int NewProfiles { get; set; }
    public int UpdatedProfiles { get; set; }
    public int FailedProfiles { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? ErrorMessage { get; set; }
}

// Request Models
public class CreateProfileRequest
{
    public required string Name { get; set; }
    public bool Enabled { get; set; } = true;
    public int Type { get; set; }
    public int Downrate { get; set; }
    public int Uprate { get; set; }
    public string? Pool { get; set; }
    public decimal Price { get; set; }
    public int Monthly { get; set; }
    public bool BurstEnabled { get; set; }
    public bool LimitExpiration { get; set; }
    public int ExpirationAmount { get; set; }
    public int ExpirationUnit { get; set; }
    public int? SiteId { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public string Icon { get; set; } = "Package";
}

public class UpdateProfileRequest
{
    public required string Name { get; set; }
    public bool Enabled { get; set; }
    public int Type { get; set; }
    public int Downrate { get; set; }
    public int Uprate { get; set; }
    public string? Pool { get; set; }
    public decimal Price { get; set; }
    public int Monthly { get; set; }
    public bool BurstEnabled { get; set; }
    public bool LimitExpiration { get; set; }
    public int ExpirationAmount { get; set; }
    public int ExpirationUnit { get; set; }
    public int? SiteId { get; set; }
}


