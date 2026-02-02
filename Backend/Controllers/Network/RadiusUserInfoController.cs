using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Helpers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Controllers.Network;

[Authorize]
[ApiController]
[Route("api/workspaces/{WorkspaceId}/radius-users")]
public class RadiusUserInfoController : ControllerBase
{
    private const string AES_KEY = "abcdefghijuklmno0123456789012345";
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusUserInfoController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public RadiusUserInfoController(
        ApplicationDbContext context,
        ILogger<RadiusUserInfoController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("{userId}/traffic")]
    public async Task<ActionResult> GetUserTraffic(int WorkspaceId, string userId, [FromBody] UserTrafficRequest request)
    {
        try
        {
            // Get the first active integration with UseSas4ForLiveSessions enabled
            var integration = await _context.SasRadiusIntegrations
                .FirstOrDefaultAsync(i => i.UseSas4ForLiveSessions && !i.IsDeleted);

            if (integration == null)
            {
                // Return empty arrays if no integration is configured
                return Ok(new
                {
                    rx = new long[0],
                    tx = new long[0],
                    total = new long[0],
                    total_real = new long[0],
                    free_traffic = new long[0]
                });
            }

            // Authenticate to get token
            var token = await AuthenticateAsync(integration);
            
            // Make API call to SAS4
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            
            var uri = new Uri(integration.Url.TrimEnd('/'));
            var url = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/user/traffic";

            var requestData = new
            {
                report_type = request.ReportType ?? "daily",
                month = request.Month,
                year = request.Year,
                user_id = userId
            };

            var requestJson = JsonSerializer.Serialize(requestData);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };

            var response = await client.PostAsJsonAsync(url, requestBody);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to fetch traffic from SAS4: {StatusCode}", response.StatusCode);
                return StatusCode((int)response.StatusCode, new { error = "Failed to fetch traffic from SAS4" });
            }

            var result = await response.Content.ReadFromJsonAsync<SasTrafficResponse>();
            
            return Ok(result?.Data ?? new SasTrafficData
            {
                Rx = new long[0],
                Tx = new long[0],
                Total = new long[0],
                TotalReal = new long[0],
                FreeTraffic = new long[0]
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user traffic for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to fetch user traffic", details = ex.Message });
        }
    }

    [HttpPost("{userId}/sessions")]
    public async Task<ActionResult> GetUserSessions(int WorkspaceId, string userId, [FromBody] UserSessionsRequest request)
    {
        try
        {
            // Get the first active integration with UseSas4ForLiveSessions enabled
            var integration = await _context.SasRadiusIntegrations
                .FirstOrDefaultAsync(i => i.UseSas4ForLiveSessions && !i.IsDeleted);

            if (integration == null)
            {
                return Ok(new
                {
                    current_page = 1,
                    data = new object[0],
                    first_page_url = "",
                    from = 0,
                    last_page = 1,
                    last_page_url = "",
                    next_page_url = (string?)null,
                    path = "",
                    per_page = request.Count,
                    prev_page_url = (string?)null,
                    to = 0,
                    total = 0
                });
            }

            // Authenticate to get token
            var token = await AuthenticateAsync(integration);
            
            // Make API call to SAS4
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            
            var uri = new Uri(integration.Url.TrimEnd('/'));
            var url = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/UserSessions/{userId}";

            var requestData = new
            {
                page = request.Page,
                count = request.Count,
                sortBy = request.SortBy ?? "acctstarttime",
                direction = request.Direction ?? "desc",
                search = request.Search ?? "",
                columns = request.Columns ?? new[] 
                { 
                    "acctstarttime", "acctstoptime", "framedipaddress", 
                    "acctoutputoctets", "acctinputoctets", "callingstationid", 
                    "calledstationid", "nasipaddress", "nasportid", 
                    "name", "acctterminatecause" 
                }
            };

            var requestJson = JsonSerializer.Serialize(requestData);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };

            var response = await client.PostAsJsonAsync(url, requestBody);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to fetch sessions from SAS4: {StatusCode}", response.StatusCode);
                return StatusCode((int)response.StatusCode, new { error = "Failed to fetch sessions from SAS4" });
            }

            var result = await response.Content.ReadAsStringAsync();
            
            return Content(result, "application/json");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user sessions for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to fetch user sessions", details = ex.Message });
        }
    }

    private async Task<string> AuthenticateAsync(Models.SasRadiusIntegration integration)
    {
        var client = _httpClientFactory.CreateClient();
        var baseUrl = integration.Url.TrimEnd('/');
        
        var uri = new Uri(baseUrl);
        var loginUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/login";
        
        _logger.LogInformation("Authenticating to SAS API at: {LoginUrl}", loginUrl);
        
        var loginData = new { username = integration.Username, password = integration.Password };
        var loginJson = JsonSerializer.Serialize(loginData);
        
        var encryptedPayload = EncryptionHelper.EncryptAES(loginJson, AES_KEY);
        
        var requestBody = new { payload = encryptedPayload };
        var response = await client.PostAsJsonAsync(loginUrl, requestBody);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            _logger.LogError("SAS API login failed with {StatusCode}: {Error}", response.StatusCode, errorBody);
        }
        
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = result.GetProperty("token").GetString();
        
        if (string.IsNullOrEmpty(token))
        {
            throw new Exception("No token received from SAS API");
        }
        
        _logger.LogInformation("Successfully authenticated to SAS API");
        return token;
    }
}

public class UserTrafficRequest
{
    [JsonPropertyName("report_type")]
    public string? ReportType { get; set; }
    
    [JsonPropertyName("month")]
    public int Month { get; set; }
    
    [JsonPropertyName("year")]
    public int Year { get; set; }
}

public class SasTrafficResponse
{
    [JsonPropertyName("status")]
    public int Status { get; set; }
    
    [JsonPropertyName("data")]
    public required SasTrafficData Data { get; set; }
}

public class SasTrafficData
{
    [JsonPropertyName("rx")]
    public required long[] Rx { get; set; }
    
    [JsonPropertyName("tx")]
    public required long[] Tx { get; set; }
    
    [JsonPropertyName("total")]
    public required long[] Total { get; set; }
    
    [JsonPropertyName("total_real")]
    public required long[] TotalReal { get; set; }
    
    [JsonPropertyName("free_traffic")]
    public required long[] FreeTraffic { get; set; }
}

public class UserSessionsRequest
{
    [JsonPropertyName("page")]
    public int Page { get; set; } = 1;
    
    [JsonPropertyName("count")]
    public int Count { get; set; } = 10;
    
    [JsonPropertyName("sortBy")]
    public string? SortBy { get; set; }
    
    [JsonPropertyName("direction")]
    public string? Direction { get; set; }
    
    [JsonPropertyName("search")]
    public string? Search { get; set; }
    
    [JsonPropertyName("columns")]
    public string[]? Columns { get; set; }
}
