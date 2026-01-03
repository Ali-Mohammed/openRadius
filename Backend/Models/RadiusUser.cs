using System.Text.Json.Serialization;

namespace Backend.Models
{
    // API Response Models
    public class SasApiResponse
    {
        [JsonPropertyName("current_page")]
        public int CurrentPage { get; set; }

        [JsonPropertyName("data")]
        public List<SasUserData> Data { get; set; } = new();

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

    public class SasUserData
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("username")]
        public string? Username { get; set; }

        [JsonPropertyName("firstname")]
        public string? Firstname { get; set; }

        [JsonPropertyName("lastname")]
        public string? Lastname { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("profile_id")]
        public int? ProfileId { get; set; }

        [JsonPropertyName("balance")]
        public string? Balance { get; set; }

        [JsonPropertyName("loan_balance")]
        public string? LoanBalance { get; set; }

        [JsonPropertyName("expiration")]
        public string? Expiration { get; set; }

        [JsonPropertyName("last_online")]
        public string? LastOnline { get; set; }

        [JsonPropertyName("parent_id")]
        public int? ParentId { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("static_ip")]
        public string? StaticIp { get; set; }

        [JsonPropertyName("enabled")]
        public int Enabled { get; set; }

        [JsonPropertyName("company")]
        public string? Company { get; set; }

        [JsonPropertyName("notes")]
        public string? Notes { get; set; }

        [JsonPropertyName("simultaneous_sessions")]
        public int SimultaneousSessions { get; set; }

        [JsonPropertyName("address")]
        public string? Address { get; set; }

        [JsonPropertyName("contract_id")]
        public string? ContractId { get; set; }

        [JsonPropertyName("created_at")]
        public string? CreatedAt { get; set; }

        [JsonPropertyName("national_id")]
        public string? NationalId { get; set; }

        [JsonPropertyName("mikrotik_ipv6_prefix")]
        public string? MikrotikIpv6Prefix { get; set; }

        [JsonPropertyName("group_id")]
        public int? GroupId { get; set; }

        [JsonPropertyName("gps_lat")]
        public string? GpsLat { get; set; }

        [JsonPropertyName("gps_lng")]
        public string? GpsLng { get; set; }

        [JsonPropertyName("street")]
        public string? Street { get; set; }

        [JsonPropertyName("site_id")]
        public int? SiteId { get; set; }

        [JsonPropertyName("pin_tries")]
        public int PinTries { get; set; }

        [JsonPropertyName("n_row")]
        public int NRow { get; set; }

        [JsonPropertyName("remaining_days")]
        public int RemainingDays { get; set; }

        [JsonPropertyName("status")]
        public SasUserStatus? Status { get; set; }

        [JsonPropertyName("online_status")]
        public int OnlineStatus { get; set; }

        [JsonPropertyName("used_traffic")]
        public long UsedTraffic { get; set; }

        [JsonPropertyName("available_traffic")]
        public long AvailableTraffic { get; set; }

        [JsonPropertyName("parent_username")]
        public string? ParentUsername { get; set; }

        [JsonPropertyName("debt_days")]
        public int DebtDays { get; set; }

        [JsonPropertyName("profile_details")]
        public SasProfileDetails? ProfileDetails { get; set; }

        [JsonPropertyName("daily_traffic_details")]
        public SasDailyTrafficDetails? DailyTrafficDetails { get; set; }

        [JsonPropertyName("group_details")]
        public SasGroupDetails? GroupDetails { get; set; }

        [JsonPropertyName("site_details")]
        public object? SiteDetails { get; set; }
    }

    public class SasUserStatus
    {
        [JsonPropertyName("status")]
        public bool Status { get; set; }

        [JsonPropertyName("traffic")]
        public bool Traffic { get; set; }

        [JsonPropertyName("expiration")]
        public bool Expiration { get; set; }

        [JsonPropertyName("uptime")]
        public bool Uptime { get; set; }
    }

    public class SasProfileDetails
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("type")]
        public int Type { get; set; }
    }

    public class SasDailyTrafficDetails
    {
        [JsonPropertyName("user_id")]
        public int UserId { get; set; }

        [JsonPropertyName("traffic")]
        public long Traffic { get; set; }
    }

    public class SasGroupDetails
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("group_name")]
        public string? GroupName { get; set; }
    }

    // Database Entity
    public class RadiusUser
    {
        public int Id { get; set; }
        public int ExternalId { get; set; }
        public string? Username { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
        public int? ProfileId { get; set; }
        
        // Navigation properties
        public RadiusProfile? Profile { get; set; }
        
        public decimal Balance { get; set; }
        public decimal LoanBalance { get; set; }
        public DateTime? Expiration { get; set; }
        public DateTime? LastOnline { get; set; }
        public int? ParentId { get; set; }
        public string? Email { get; set; }
        public string? StaticIp { get; set; }
        public bool Enabled { get; set; }
        public string? Company { get; set; }
        public string? Notes { get; set; }
        public int SimultaneousSessions { get; set; }
        public string? Address { get; set; }
        public string? ContractId { get; set; }
        public string? NationalId { get; set; }
        public string? MikrotikIpv6Prefix { get; set; }
        public int? GroupId { get; set; }
        public string? GpsLat { get; set; }
        public string? GpsLng { get; set; }
        public string? Street { get; set; }
        public int? SiteId { get; set; }
        public int PinTries { get; set; }
        public int RemainingDays { get; set; }
        public int OnlineStatus { get; set; }
        public long UsedTraffic { get; set; }
        public long AvailableTraffic { get; set; }
        public string? ParentUsername { get; set; }
        public int DebtDays { get; set; }
        
        // Soft Delete
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        
        // Foreign Keys
        public int WorkspaceId { get; set; }
        
        // Timestamps
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
    }

    // Request/Response Models for API
    public class SyncUsersResponse
    {
        public string SyncId { get; set; } = Guid.NewGuid().ToString();
        public bool Success { get; set; }
        public string? Message { get; set; }
        public int TotalUsers { get; set; }
        public int NewUsers { get; set; }
        public int UpdatedUsers { get; set; }
        public int FailedUsers { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class RadiusUserResponse
    {
        public int Id { get; set; }
        public int ExternalId { get; set; }
        public string? Username { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public int? ProfileId { get; set; }
        public string? ProfileName { get; set; }
        public decimal Balance { get; set; }
        public decimal LoanBalance { get; set; }
        public DateTime? Expiration { get; set; }
        public DateTime? LastOnline { get; set; }
        public bool Enabled { get; set; }
        public int OnlineStatus { get; set; }
        public int RemainingDays { get; set; }
        public int DebtDays { get; set; }
        public string? StaticIp { get; set; }
        public string? Company { get; set; }
        public string? Address { get; set; }
        public string? ContractId { get; set; }
        public int? SimultaneousSessions { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
    }

    public class CreateUserRequest
    {
        public required string Username { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? City { get; set; }
        public int? ProfileId { get; set; }
        public decimal Balance { get; set; }
        public DateTime? Expiration { get; set; }
        public bool Enabled { get; set; } = true;
        public string? StaticIp { get; set; }
        public string? Company { get; set; }
        public string? Address { get; set; }
        public string? ContractId { get; set; }
        public int SimultaneousSessions { get; set; } = 1;
    }

    public class UpdateUserRequest
    {
        public string? Username { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? City { get; set; }
        public int? ProfileId { get; set; }
        public decimal? Balance { get; set; }
        public DateTime? Expiration { get; set; }
        public bool? Enabled { get; set; }
        public string? StaticIp { get; set; }
        public string? Company { get; set; }
        public string? Address { get; set; }
        public string? ContractId { get; set; }
        public int? SimultaneousSessions { get; set; }
    }
}


