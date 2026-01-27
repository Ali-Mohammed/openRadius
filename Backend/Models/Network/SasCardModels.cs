using System.Text.Json.Serialization;

namespace Backend.Models;

// Card Series API Response Models
public class SasCardSeriesApiResponse
{
    [JsonPropertyName("current_page")]
    public int CurrentPage { get; set; }

    [JsonPropertyName("data")]
    public List<SasCardSeriesData> Data { get; set; } = new();

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

public class SasCardSeriesData
{
    [JsonPropertyName("series")]
    public string? Series { get; set; }

    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("owner")]
    public int Owner { get; set; }

    [JsonPropertyName("value")]
    public string? Value { get; set; }

    [JsonPropertyName("expiration")]
    public string? Expiration { get; set; }

    [JsonPropertyName("qty")]
    public int Qty { get; set; }

    [JsonPropertyName("used")]
    public string? Used { get; set; }

    [JsonPropertyName("profile_id")]
    public int ProfileId { get; set; }

    [JsonPropertyName("addon_id")]
    public int? AddonId { get; set; }

    [JsonPropertyName("series_date")]
    public string? SeriesDate { get; set; }

    [JsonPropertyName("suspended")]
    public int Suspended { get; set; }

    [JsonPropertyName("owner_details")]
    public SasOwnerDetails? OwnerDetails { get; set; }

    [JsonPropertyName("profile_details")]
    public SasProfileDetails? ProfileDetails { get; set; }

    [JsonPropertyName("addon_details")]
    public SasAddonDetails? AddonDetails { get; set; }
}

public class SasOwnerDetails
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }
}

public class SasAddonDetails
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

// Card PIN API Response Models
public class SasCardPinApiResponse
{
    [JsonPropertyName("current_page")]
    public int CurrentPage { get; set; }

    [JsonPropertyName("data")]
    public List<SasCardPinData> Data { get; set; } = new();

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

public class SasCardPinData
{
    [JsonPropertyName("serialnumber")]
    public string? SerialNumber { get; set; }

    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("pin")]
    public string? Pin { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("password")]
    public string? Password { get; set; }

    [JsonPropertyName("used_at")]
    public string? UsedAt { get; set; }

    [JsonPropertyName("user_id")]
    public int? UserId { get; set; }

    [JsonPropertyName("manager_id")]
    public int? ManagerId { get; set; }

    [JsonPropertyName("manager_details")]
    public SasManagerDetails? ManagerDetails { get; set; }

    [JsonPropertyName("user_details")]
    public SasUserDetails? UserDetails { get; set; }
}

public class SasManagerDetails
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }
}

public class SasUserDetails
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("parent_username")]
    public string? ParentUsername { get; set; }

    [JsonPropertyName("debt_days")]
    public int DebtDays { get; set; }
}
