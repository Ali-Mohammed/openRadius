using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Collections.Concurrent;
using Backend.Data;
using Backend.Helpers;
using Backend.Hubs;
using Backend.Models;

namespace Backend.Services;

public class SasSyncService : ISasSyncService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<SasSyncHub> _hubContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SasSyncService> _logger;
    private static readonly ConcurrentDictionary<Guid, CancellationTokenSource> _activeSyncs = new();

    public SasSyncService(
        IServiceScopeFactory scopeFactory,
        IHubContext<SasSyncHub> hubContext,
        IHttpClientFactory httpClientFactory,
        ILogger<SasSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<Guid> SyncAsync(int integrationId, int WorkspaceId, bool fullSync = false)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            
            // Check for active syncs (status < 8 means not completed/failed/cancelled)
            var activeSync = await context.SyncProgresses
                .Where(s => s.Status < SyncStatus.Completed)
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();

            if (activeSync != null)
            {
                throw new InvalidOperationException(
                    $"Cannot start sync: Another sync is already in progress for '{activeSync.IntegrationName}' " +
                    $"(Status: {activeSync.Status}, Progress: {activeSync.ProgressPercentage:F0}%). " +
                    $"Please wait for it to complete or cancel it first.");
            }

            // Get integration settings
            var integration = await context.SasRadiusIntegrations
                .FirstOrDefaultAsync(i => i.Id == integrationId);

            if (integration == null)
            {
                throw new InvalidOperationException($"Integration {integrationId} not found");
            }

            var syncId = Guid.NewGuid();

            // Create sync progress record
            var syncProgress = new SyncProgress
            {
                SyncId = syncId,
                IntegrationId = integrationId,
                IntegrationName = integration.Name,
                WorkspaceId = WorkspaceId,
                Status = SyncStatus.Starting,
                CurrentPhase = SyncPhase.NotStarted,
                ProgressPercentage = 0,
                StartedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            };

            await context.SyncProgresses.AddAsync(syncProgress);
            await context.SaveChangesAsync();

            // Create cancellation token for this sync
            var cts = new CancellationTokenSource();
            _activeSyncs[syncId] = cts;

            // Start sync in background
            _ = Task.Run(async () => 
            {
                try
                {
                    await ExecuteSyncAsync(syncId, integration, fullSync, cts.Token);
                }
                finally
                {
                    _activeSyncs.TryRemove(syncId, out _);
                    cts.Dispose();
                }
            });

            return syncId;
        }
    }

    public async Task<bool> CancelSyncAsync(Guid syncId, int WorkspaceId)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var sync = await context.SyncProgresses
            .FirstOrDefaultAsync(s => s.SyncId == syncId);
        
        if (sync == null)
        {
            return false;
        }
        
        // Check if sync is already completed, failed, or cancelled
        if (sync.Status == SyncStatus.Completed || sync.Status == SyncStatus.Failed || sync.Status == SyncStatus.Cancelled)
        {
            return false;
        }
        
        // Try to cancel the background task if it's still running
        if (_activeSyncs.TryGetValue(syncId, out var cts))
        {
            cts.Cancel();
        }
        
        // Update sync status regardless of whether task was in dictionary
        sync.Status = SyncStatus.Cancelled;
        sync.CurrentMessage = "Sync cancelled by user";
        sync.CompletedAt = DateTime.UtcNow;
        sync.LastUpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        
        await SendProgressUpdateToClients(sync);
        
        return true;
    }

    private async Task ExecuteSyncAsync(Guid syncId, SasRadiusIntegration integration, bool fullSync, CancellationToken cancellationToken)
    {
        try
        {
            await UpdateProgress(syncId, SyncStatus.Starting, SyncPhase.NotStarted, 5, "Starting synchronization...", cancellationToken);

            // Authenticate
            await UpdateProgress(syncId, SyncStatus.Authenticating, SyncPhase.NotStarted, 10, "Authenticating with SAS Radius server...", cancellationToken);
            var token = await AuthenticateAsync(integration);

            // Sync Profiles First
            await UpdateProgress(syncId, SyncStatus.SyncingProfiles, SyncPhase.Profiles, 15, "Starting profile synchronization...", cancellationToken);
            await SyncProfilesAsync(syncId, integration, token, cancellationToken);

            // Sync Groups
            await UpdateProgress(syncId, SyncStatus.SyncingProfiles, SyncPhase.Groups, 35, "Starting group synchronization...", cancellationToken);
            await SyncGroupsAsync(syncId, integration, token, cancellationToken);

            // Sync Zones from Manager Tree
            await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Zones, 50, "Starting zone synchronization...", cancellationToken);
            var sasIdToZoneId = await SyncZonesAsync(syncId, integration, token, cancellationToken);

            // Then Sync Users
            await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Users, 55, "Starting user synchronization...", cancellationToken);
            await SyncUsersAsync(syncId, integration, token, sasIdToZoneId, cancellationToken);

            // Complete
            await UpdateProgress(syncId, SyncStatus.Completed, SyncPhase.Completed, 100, "Synchronization completed successfully", cancellationToken);
            
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var progress = await context.SyncProgresses.FindAsync(syncId);
            if (progress != null)
            {
                progress.CompletedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Sync {SyncId} was cancelled", syncId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync {SyncId} failed", syncId);
            await UpdateProgress(syncId, SyncStatus.Failed, SyncPhase.NotStarted, 0, $"Synchronization failed: {ex.Message}", cancellationToken, ex.Message);
        }
    }

    private async Task<string> AuthenticateAsync(SasRadiusIntegration integration)
    {
        var client = _httpClientFactory.CreateClient();
        var baseUrl = integration.Url.TrimEnd('/');
        
        // SAS API encryption key (must match the key on SAS server)
        const string AES_KEY = "abcdefghijuklmno0123456789012345"; // 32 bytes for AES-256
        
        // Construct the login URL with SAS API path
        var uri = new Uri(baseUrl);
        var loginUrl = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/login";
        
        _logger.LogInformation("Authenticating to SAS API at: {LoginUrl}", loginUrl);
        
        // Prepare login credentials (use plain password, not encrypted from DB)
        var loginData = new { username = integration.Username, password = integration.Password };
        var loginJson = System.Text.Json.JsonSerializer.Serialize(loginData);
        
        // Encrypt the entire JSON payload using AES (SAS API requirement)
        var encryptedPayload = EncryptionHelper.EncryptAES(loginJson, AES_KEY);
        
        // Send request with encrypted payload
        var requestBody = new { payload = encryptedPayload };
        var response = await client.PostAsJsonAsync(loginUrl, requestBody);
        
        // Log response for debugging
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

    private async Task SyncProfilesAsync(Guid syncId, SasRadiusIntegration integration, string token, CancellationToken cancellationToken)
    {
        const string AES_KEY = "abcdefghijuklmno0123456789012345";
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var uri = new Uri(integration.Url.TrimEnd('/'));
        var url = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/profile";

        int currentPage = 1;
        int pageSize = integration.MaxItemInPagePerRequest > 0 ? integration.MaxItemInPagePerRequest : 100; // Items per page
        bool hasMorePages = true;
        int totalPagesFromApi = 1; // Will be updated from API response

        while (hasMorePages)
        {
            cancellationToken.ThrowIfCancellationRequested();
            
            // Calculate progress based on actual total pages
            double progress = totalPagesFromApi > 1 ? (currentPage / (double)totalPagesFromApi) * 35 : 0;
            await UpdateProgress(syncId, SyncStatus.FetchingProfilePage, SyncPhase.Profiles, 
                15 + (int)progress, 
                $"Fetching profile page {currentPage} of {totalPagesFromApi}...", cancellationToken);

            // Prepare request payload
            var requestData = new
            {
                page = currentPage,
                count = pageSize,
                sortBy = "name",
                direction = "asc",
                search = ""
            };
            
            var requestJson = System.Text.Json.JsonSerializer.Serialize(requestData);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            var response = await client.PostAsJsonAsync(url, requestBody, cancellationToken);
            response.EnsureSuccessStatusCode();

            var apiResponse = await response.Content.ReadFromJsonAsync<SasProfileApiResponse>(cancellationToken: cancellationToken);
            
            if (apiResponse == null || apiResponse.Data == null)
                break;

            // Update total pages from API response
            totalPagesFromApi = apiResponse.LastPage;

            double processProgress = totalPagesFromApi > 1 ? (currentPage / (double)totalPagesFromApi) * 35 : 0;
            await UpdateProgress(syncId, SyncStatus.ProcessingProfiles, SyncPhase.Profiles, 
                15 + (int)processProgress, 
                $"Processing {apiResponse.Data.Count} profiles from page {currentPage} of {totalPagesFromApi}...", cancellationToken);

            using (var scope = _scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                
                // Update progress totals
                var profileProgress = await context.SyncProgresses.FindAsync(syncId);
                if (profileProgress != null)
                {
                    profileProgress.ProfileTotalPages = apiResponse.LastPage;
                    profileProgress.ProfileCurrentPage = currentPage;
                    profileProgress.ProfileTotalRecords = apiResponse.Total;

                    foreach (var sasProfile in apiResponse.Data)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        
                        try
                        {
                            var existingProfile = await context.RadiusProfiles
                                .FirstOrDefaultAsync(p => p.ExternalId == sasProfile.Id, cancellationToken);

                            if (existingProfile == null)
                            {
                                var newProfile = new RadiusProfile
                                {
                                    ExternalId = sasProfile.Id,
                                    Name = sasProfile.Name ?? string.Empty,
                                    Downrate = sasProfile.Downrate,
                                    Uprate = sasProfile.Uprate,
                                    Price = sasProfile.Price,
                                    Pool = sasProfile.Pool,
                                    Type = sasProfile.Type,
                                    ExpirationAmount = sasProfile.ExpirationAmount,
                                    ExpirationUnit = sasProfile.ExpirationUnit,
                                    Enabled = sasProfile.Enabled == 1,
                                    BurstEnabled = sasProfile.BurstEnabled == 1,
                                    Monthly = sasProfile.Monthly,
                                    LimitExpiration = sasProfile.LimitExpiration == 1,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow,
                                    LastSyncedAt = DateTime.UtcNow
                                };
                                await context.RadiusProfiles.AddAsync(newProfile, cancellationToken);
                                profileProgress.ProfileNewRecords++;
                            }
                            else
                            {
                                existingProfile.Name = sasProfile.Name ?? string.Empty;
                                existingProfile.Downrate = sasProfile.Downrate;
                                existingProfile.Uprate = sasProfile.Uprate;
                                existingProfile.Price = sasProfile.Price;
                                existingProfile.Pool = sasProfile.Pool;
                                existingProfile.Type = sasProfile.Type;
                                existingProfile.ExpirationAmount = sasProfile.ExpirationAmount;
                                existingProfile.ExpirationUnit = sasProfile.ExpirationUnit;
                                existingProfile.Enabled = sasProfile.Enabled == 1;
                                existingProfile.BurstEnabled = sasProfile.BurstEnabled == 1;
                                existingProfile.Monthly = sasProfile.Monthly;
                                existingProfile.LimitExpiration = sasProfile.LimitExpiration == 1;
                                existingProfile.UpdatedAt = DateTime.UtcNow;
                                existingProfile.LastSyncedAt = DateTime.UtcNow;
                                profileProgress.ProfileUpdatedRecords++;
                            }

                            profileProgress.ProfileProcessedRecords++;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to process profile {ProfileId}", sasProfile.Id);
                            profileProgress.ProfileFailedRecords++;
                        }
                    }

                    await context.SaveChangesAsync(cancellationToken);
                    await SendProgressUpdateToClients(profileProgress);
                }
            }

            hasMorePages = currentPage < apiResponse.LastPage;
            currentPage++;
        }
    }

    private async Task SyncUsersAsync(Guid syncId, SasRadiusIntegration integration, string token, Dictionary<int, int> sasIdToZoneId, CancellationToken cancellationToken)
    {
        const string AES_KEY = "abcdefghijuklmno0123456789012345";
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var uri = new Uri(integration.Url.TrimEnd('/'));
        var url = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/user";

        int currentPage = 1;
        int pageSize = integration.MaxItemInPagePerRequest > 0 ? integration.MaxItemInPagePerRequest : 100; // Items per page
        bool hasMorePages = true;
        int totalPagesFromApi = 1; // Will be updated from API response

        while (hasMorePages)
        {
            cancellationToken.ThrowIfCancellationRequested();
            
            // Calculate progress based on actual total pages
            double progress = totalPagesFromApi > 1 ? (currentPage / (double)totalPagesFromApi) * 40 : 0;
            await UpdateProgress(syncId, SyncStatus.FetchingUserPage, SyncPhase.Users, 
                55 + (int)progress, 
                $"Fetching user page {currentPage} of {totalPagesFromApi}...", cancellationToken);

            // Prepare request payload with all required columns
            var requestData = new
            {
                page = currentPage,
                count = pageSize,
                sortBy = "username",
                direction = "asc",
                search = "",
                columns = new[]
                {
                    "n_row", "idx", "id", "username", "firstname", "lastname", "expiration",
                    "parent_username", "name", "balance", "loan_balance", "group_name", "traffic",
                    "city", "remaining_days", "static_ip", "notes", "last_online", "company",
                    "simultaneous_sessions", "used_traffic", "phone", "address", "contract_id",
                    "created_at", "available_traffic", "national_id", "mikrotik_ipv6_prefix",
                    "site_name", "pin_tries", "debt_days"
                }
            };
            
            var requestJson = System.Text.Json.JsonSerializer.Serialize(requestData);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            var response = await client.PostAsJsonAsync(url, requestBody, cancellationToken);
            response.EnsureSuccessStatusCode();

            var apiResponse = await response.Content.ReadFromJsonAsync<SasApiResponse>(cancellationToken: cancellationToken);
            
            if (apiResponse == null || apiResponse.Data == null)
                break;

            // Update total pages from API response
            totalPagesFromApi = apiResponse.LastPage;

            double processProgress = totalPagesFromApi > 1 ? (currentPage / (double)totalPagesFromApi) * 40 : 0;
            await UpdateProgress(syncId, SyncStatus.ProcessingUsers, SyncPhase.Users, 
                55 + (int)processProgress, 
                $"Processing {apiResponse.Data.Count} users from page {currentPage} of {totalPagesFromApi}...", cancellationToken);

            using (var scope = _scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                
                // Update progress totals
                var userProgress = await context.SyncProgresses.FindAsync(syncId);
                if (userProgress != null)
                {
                    userProgress.UserTotalPages = apiResponse.LastPage;
                    userProgress.UserCurrentPage = currentPage;
                    userProgress.UserTotalRecords = apiResponse.Total;

                    foreach (var sasUser in apiResponse.Data)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        
                        try
                        {
                            var existingUser = await context.RadiusUsers
                                .FirstOrDefaultAsync(u => u.ExternalId == sasUser.Id, cancellationToken);

                            // Map external ProfileId to database ProfileId
                            int? dbProfileId = null;
                            if (sasUser.ProfileId.HasValue)
                            {
                                var profile = await context.RadiusProfiles
                                    .FirstOrDefaultAsync(p => p.ExternalId == sasUser.ProfileId.Value, cancellationToken);
                                dbProfileId = profile?.Id;
                            }

                            // Map external GroupId to database GroupId
                            int? dbGroupId = null;
                            if (sasUser.GroupId.HasValue)
                            {
                                var group = await context.RadiusGroups
                                    .FirstOrDefaultAsync(g => g.ExternalId == sasUser.GroupId.Value, cancellationToken);
                                dbGroupId = group?.Id;
                            }

                            // Map ParentId to ZoneId
                            int? zoneId = null;
                            if (sasUser.ParentId.HasValue && sasIdToZoneId.ContainsKey(sasUser.ParentId.Value))
                            {
                                zoneId = sasIdToZoneId[sasUser.ParentId.Value];
                            }

                            if (existingUser == null)
                            {
                                // Parse GPS coordinates from contract_id if available
                                string? gpsLat = null;
                                string? gpsLng = null;
                                if (!string.IsNullOrEmpty(sasUser.ContractId) && sasUser.ContractId.Contains(","))
                                {
                                    var coords = sasUser.ContractId.Split(',', StringSplitOptions.TrimEntries);
                                    if (coords.Length == 2)
                                    {
                                        gpsLat = coords[0];
                                        gpsLng = coords[1];
                                    }
                                }

                                // Parse device serial number from notes if available
                                string? deviceSerialNumber = sasUser.Notes;

                                var newUser = new RadiusUser
                                {
                                    ExternalId = sasUser.Id,
                                    Username = sasUser.Username ?? string.Empty,
                                    Firstname = sasUser.Firstname,
                                    Lastname = sasUser.Lastname,
                                    City = sasUser.City,
                                    Phone = sasUser.Phone,
                                    ProfileId = dbProfileId,
                                    ZoneId = zoneId,
                                    Balance = string.IsNullOrEmpty(sasUser.Balance) ? 0 : decimal.Parse(sasUser.Balance),
                                    LoanBalance = string.IsNullOrEmpty(sasUser.LoanBalance) ? 0 : decimal.Parse(sasUser.LoanBalance),
                                    Expiration = string.IsNullOrEmpty(sasUser.Expiration) ? null : DateTime.SpecifyKind(DateTime.Parse(sasUser.Expiration), DateTimeKind.Utc),
                                    LastOnline = string.IsNullOrEmpty(sasUser.LastOnline) ? null : DateTime.SpecifyKind(DateTime.Parse(sasUser.LastOnline), DateTimeKind.Utc),
                                    ParentId = sasUser.ParentId,
                                    Email = sasUser.Email,
                                    StaticIp = sasUser.StaticIp,
                                    Enabled = sasUser.Enabled == 1,
                                    Company = sasUser.Company,
                                    Notes = "",
                                    DeviceSerialNumber = deviceSerialNumber,
                                    SimultaneousSessions = sasUser.SimultaneousSessions ?? 1,
                                    Address = sasUser.Address,
                                    ContractId = "",
                                    NationalId = sasUser.NationalId,
                                    MikrotikIpv6Prefix = sasUser.MikrotikIpv6Prefix,
                                    GroupId = dbGroupId,
                                    GpsLat = gpsLat ?? sasUser.GpsLat,
                                    GpsLng = gpsLng ?? sasUser.GpsLng,
                                    Street = sasUser.Street,
                                    SiteId = sasUser.SiteId,
                                    PinTries = sasUser.PinTries,
                                    RemainingDays = sasUser.RemainingDays,
                                    OnlineStatus = sasUser.OnlineStatus,
                                    UsedTraffic = sasUser.UsedTraffic,
                                    AvailableTraffic = sasUser.AvailableTraffic,
                                    ParentUsername = sasUser.ParentUsername,
                                    DebtDays = sasUser.DebtDays,
                                    CreatedAt = string.IsNullOrEmpty(sasUser.CreatedAt) ? DateTime.UtcNow : DateTime.SpecifyKind(DateTime.Parse(sasUser.CreatedAt), DateTimeKind.Utc),
                                    UpdatedAt = string.IsNullOrEmpty(sasUser.CreatedAt) ? DateTime.UtcNow : DateTime.SpecifyKind(DateTime.Parse(sasUser.CreatedAt), DateTimeKind.Utc),
                                    LastSyncedAt = DateTime.UtcNow
                                };
                                await context.RadiusUsers.AddAsync(newUser, cancellationToken);
                                await context.SaveChangesAsync(cancellationToken); // Save to get the user ID
                                
                                // Create IP reservation if user has static IP
                                if (!string.IsNullOrWhiteSpace(sasUser.StaticIp))
                                {
                                    // Check if IP reservation already exists for this IP
                                    var existingIpReservation = await context.RadiusIpReservations
                                        .FirstOrDefaultAsync(r => r.IpAddress == sasUser.StaticIp && r.DeletedAt == null, cancellationToken);
                                    
                                    if (existingIpReservation == null)
                                    {
                                        var ipReservation = new RadiusIpReservation
                                        {
                                            IpAddress = sasUser.StaticIp,
                                            Description = $"Auto-imported for user {sasUser.Username}",
                                            RadiusUserId = newUser.Id,
                                            CreatedAt = DateTime.UtcNow,
                                            UpdatedAt = DateTime.UtcNow
                                        };
                                        await context.RadiusIpReservations.AddAsync(ipReservation, cancellationToken);
                                    }
                                    else if (existingIpReservation.RadiusUserId != newUser.Id)
                                    {
                                        // IP already reserved for another user, log warning
                                        _logger.LogWarning("IP {IpAddress} already reserved for user ID {UserId}, cannot assign to user {Username}", 
                                            sasUser.StaticIp, existingIpReservation.RadiusUserId, sasUser.Username);
                                    }
                                }
                                
                                userProgress.UserNewRecords++;
                            }
                            else
                            {
                                // Parse GPS coordinates from contract_id if available
                                string? gpsLat = null;
                                string? gpsLng = null;
                                if (!string.IsNullOrEmpty(sasUser.ContractId) && sasUser.ContractId.Contains(","))
                                {
                                    var coords = sasUser.ContractId.Split(',', StringSplitOptions.TrimEntries);
                                    if (coords.Length == 2)
                                    {
                                        gpsLat = coords[0];
                                        gpsLng = coords[1];
                                    }
                                }

                                // Parse device serial number from notes if available
                                string? deviceSerialNumber = sasUser.Notes;

                                existingUser.Username = sasUser.Username ?? string.Empty;
                                existingUser.Firstname = sasUser.Firstname;
                                existingUser.Lastname = sasUser.Lastname;
                                existingUser.City = sasUser.City;
                                existingUser.Phone = sasUser.Phone;
                                existingUser.ProfileId = dbProfileId;
                                existingUser.ZoneId = zoneId;
                                existingUser.Balance = string.IsNullOrEmpty(sasUser.Balance) ? 0 : decimal.Parse(sasUser.Balance);
                                existingUser.LoanBalance = string.IsNullOrEmpty(sasUser.LoanBalance) ? 0 : decimal.Parse(sasUser.LoanBalance);
                                existingUser.Expiration = string.IsNullOrEmpty(sasUser.Expiration) ? null : DateTime.SpecifyKind(DateTime.Parse(sasUser.Expiration), DateTimeKind.Utc);
                                existingUser.LastOnline = string.IsNullOrEmpty(sasUser.LastOnline) ? null : DateTime.SpecifyKind(DateTime.Parse(sasUser.LastOnline), DateTimeKind.Utc);
                                existingUser.ParentId = sasUser.ParentId;
                                existingUser.Email = sasUser.Email;
                                existingUser.StaticIp = sasUser.StaticIp;
                                existingUser.Enabled = sasUser.Enabled == 1;
                                existingUser.Company = sasUser.Company;
                                existingUser.Notes = "";
                                existingUser.DeviceSerialNumber = deviceSerialNumber;
                                existingUser.SimultaneousSessions = sasUser.SimultaneousSessions ?? 1;
                                existingUser.Address = sasUser.Address;
                                existingUser.ContractId = "";
                                existingUser.NationalId = sasUser.NationalId;
                                existingUser.MikrotikIpv6Prefix = sasUser.MikrotikIpv6Prefix;
                                existingUser.GroupId = dbGroupId;
                                existingUser.GpsLat = gpsLat ?? sasUser.GpsLat;
                                existingUser.GpsLng = gpsLng ?? sasUser.GpsLng;
                                existingUser.Street = sasUser.Street;
                                existingUser.SiteId = sasUser.SiteId;
                                existingUser.PinTries = sasUser.PinTries;
                                existingUser.RemainingDays = sasUser.RemainingDays;
                                existingUser.OnlineStatus = sasUser.OnlineStatus;
                                existingUser.UsedTraffic = sasUser.UsedTraffic;
                                existingUser.AvailableTraffic = sasUser.AvailableTraffic;
                                existingUser.ParentUsername = sasUser.ParentUsername;
                                existingUser.DebtDays = sasUser.DebtDays;
                                existingUser.UpdatedAt = DateTime.UtcNow;
                                existingUser.LastSyncedAt = DateTime.UtcNow;
                                
                                // Sync IP reservation for existing user
                                if (!string.IsNullOrWhiteSpace(sasUser.StaticIp))
                                {
                                    // Check if this user already has an IP reservation
                                    var existingUserIpReservation = await context.RadiusIpReservations
                                        .FirstOrDefaultAsync(r => r.RadiusUserId == existingUser.Id && r.DeletedAt == null, cancellationToken);
                                    
                                    if (existingUserIpReservation != null)
                                    {
                                        // Update existing reservation if IP changed
                                        if (existingUserIpReservation.IpAddress != sasUser.StaticIp)
                                        {
                                            // Check if new IP is already reserved by another user
                                            var ipConflict = await context.RadiusIpReservations
                                                .FirstOrDefaultAsync(r => r.IpAddress == sasUser.StaticIp && r.DeletedAt == null && r.Id != existingUserIpReservation.Id, cancellationToken);
                                            
                                            if (ipConflict == null)
                                            {
                                                existingUserIpReservation.IpAddress = sasUser.StaticIp;
                                                existingUserIpReservation.UpdatedAt = DateTime.UtcNow;
                                            }
                                            else
                                            {
                                                _logger.LogWarning("Cannot update IP to {IpAddress} for user {Username} - already reserved by user ID {UserId}", 
                                                    sasUser.StaticIp, sasUser.Username, ipConflict.RadiusUserId);
                                            }
                                        }
                                    }
                                    else
                                    {
                                        // Create new IP reservation
                                        var existingIpReservation = await context.RadiusIpReservations
                                            .FirstOrDefaultAsync(r => r.IpAddress == sasUser.StaticIp && r.DeletedAt == null, cancellationToken);
                                        
                                        if (existingIpReservation == null)
                                        {
                                            var ipReservation = new RadiusIpReservation
                                            {
                                                IpAddress = sasUser.StaticIp,
                                                Description = $"Auto-imported for user {sasUser.Username}",
                                                RadiusUserId = existingUser.Id,
                                                CreatedAt = DateTime.UtcNow,
                                                UpdatedAt = DateTime.UtcNow
                                            };
                                            await context.RadiusIpReservations.AddAsync(ipReservation, cancellationToken);
                                        }
                                        else if (existingIpReservation.RadiusUserId != existingUser.Id)
                                        {
                                            _logger.LogWarning("IP {IpAddress} already reserved for user ID {UserId}, cannot assign to user {Username}", 
                                                sasUser.StaticIp, existingIpReservation.RadiusUserId, sasUser.Username);
                                        }
                                    }
                                }
                                else
                                {
                                    // User no longer has static IP, remove reservation if exists
                                    var existingUserIpReservation = await context.RadiusIpReservations
                                        .FirstOrDefaultAsync(r => r.RadiusUserId == existingUser.Id && r.DeletedAt == null, cancellationToken);
                                    
                                    if (existingUserIpReservation != null)
                                    {
                                        existingUserIpReservation.DeletedAt = DateTime.UtcNow;
                                        existingUserIpReservation.DeletedBy = "System (Sync)";
                                    }
                                }
                                
                                userProgress.UserUpdatedRecords++;
                            }

                            userProgress.UserProcessedRecords++;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to process user {UserId}", sasUser.Id);
                            userProgress.UserFailedRecords++;
                        }
                    }

                    await context.SaveChangesAsync(cancellationToken);
                    await SendProgressUpdateToClients(userProgress);
                }
            }

            hasMorePages = currentPage < apiResponse.LastPage;
            currentPage++;
        }
    }

    private async Task SyncGroupsAsync(Guid syncId, SasRadiusIntegration integration, string token, CancellationToken cancellationToken)
    {
        const string AES_KEY = "abcdefghijuklmno0123456789012345";
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var uri = new Uri(integration.Url.TrimEnd('/'));
        var url = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/index/group";

        int currentPage = 1;
        int pageSize = integration.MaxItemInPagePerRequest > 0 ? integration.MaxItemInPagePerRequest : 100;
        bool hasMorePages = true;
        int totalPagesFromApi = 1;

        while (hasMorePages)
        {
            cancellationToken.ThrowIfCancellationRequested();
            
            double progress = totalPagesFromApi > 1 ? (currentPage / (double)totalPagesFromApi) * 15 : 0;
            await UpdateProgress(syncId, SyncStatus.SyncingProfiles, SyncPhase.Groups, 
                35 + (int)progress, 
                $"Fetching group page {currentPage} of {totalPagesFromApi}...", cancellationToken);

            var requestData = new
            {
                page = currentPage,
                count = pageSize,
                sortBy = "name",
                direction = "asc",
                search = ""
            };
            
            var requestJson = System.Text.Json.JsonSerializer.Serialize(requestData);
            var encryptedPayload = EncryptionHelper.EncryptAES(requestJson, AES_KEY);
            var requestBody = new { payload = encryptedPayload };
            
            var response = await client.PostAsJsonAsync(url, requestBody, cancellationToken);
            response.EnsureSuccessStatusCode();

            var apiResponse = await response.Content.ReadFromJsonAsync<SasGroupApiResponse>(cancellationToken: cancellationToken);
            
            if (apiResponse == null || apiResponse.Data == null)
                break;

            totalPagesFromApi = apiResponse.LastPage;

            double processProgress = totalPagesFromApi > 1 ? (currentPage / (double)totalPagesFromApi) * 15 : 0;
            await UpdateProgress(syncId, SyncStatus.ProcessingProfiles, SyncPhase.Groups, 
                35 + (int)processProgress, 
                $"Processing {apiResponse.Data.Count} groups from page {currentPage} of {totalPagesFromApi}...", cancellationToken);

            using (var scope = _scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                
                var groupProgress = await context.SyncProgresses.FindAsync(syncId);
                if (groupProgress != null)
                {
                    groupProgress.GroupTotalPages = apiResponse.LastPage;
                    groupProgress.GroupCurrentPage = currentPage;
                    groupProgress.GroupTotalRecords = apiResponse.Total;

                    foreach (var sasGroup in apiResponse.Data)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        
                        try
                        {
                            var existingGroup = await context.RadiusGroups
                                .FirstOrDefaultAsync(g => g.ExternalId == sasGroup.Id, cancellationToken);

                            if (existingGroup == null)
                            {
                                var newGroup = new RadiusGroup
                                {
                                    ExternalId = sasGroup.Id,
                                    Name = sasGroup.Name,
                                    Description = sasGroup.Description,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow,
                                    LastSyncedAt = DateTime.UtcNow
                                };
                                await context.RadiusGroups.AddAsync(newGroup, cancellationToken);
                                groupProgress.GroupNewRecords++;
                            }
                            else
                            {
                                existingGroup.Name = sasGroup.Name;
                                existingGroup.Description = sasGroup.Description;
                                existingGroup.UpdatedAt = DateTime.UtcNow;
                                existingGroup.LastSyncedAt = DateTime.UtcNow;
                                groupProgress.GroupUpdatedRecords++;
                            }

                            groupProgress.GroupProcessedRecords++;
                        }
             
                       catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to process group {GroupId}", sasGroup.Id);
                            groupProgress.GroupFailedRecords++;
                        }
                    }

                    await context.SaveChangesAsync(cancellationToken);
                    await SendProgressUpdateToClients(groupProgress);
                }
            }

            hasMorePages = currentPage < apiResponse.LastPage;
            currentPage++;
        }
    }

    private async Task<Dictionary<int, int>> SyncZonesAsync(Guid syncId, SasRadiusIntegration integration, string token, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var uri = new Uri(integration.Url.TrimEnd('/'));
        var url = $"{uri.Scheme}://{uri.Authority}/admin/api/index.php/api/manager/tree";

        await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Zones, 50, "Fetching manager tree for zones...", cancellationToken);

        var response = await client.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        var treeNodes = await response.Content.ReadFromJsonAsync<List<SasTreeNode>>(cancellationToken);
        
        if (treeNodes == null || treeNodes.Count == 0)
        {
            _logger.LogWarning("No tree nodes received from SAS API");
            return new Dictionary<int, int>();
        }

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var zoneProgress = await context.SyncProgresses.FindAsync(syncId);
        
        if (zoneProgress == null) return new Dictionary<int, int>();

        // Initialize zone tracking
        zoneProgress.ZoneTotalRecords = treeNodes.Count;
        zoneProgress.ZoneProcessedRecords = 0;
        zoneProgress.ZoneNewRecords = 0;
        zoneProgress.ZoneUpdatedRecords = 0;
        zoneProgress.ZoneFailedRecords = 0;
        await context.SaveChangesAsync(cancellationToken);

        await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Zones, 51, $"Processing {treeNodes.Count} zones...", cancellationToken);

        // Build a lookup dictionary for parent resolution
        var sasIdToZoneId = new Dictionary<int, int>();
        
        // First pass: Create or update all zones without parent relationships
        foreach (var node in treeNodes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            
            try
            {
                var existingZone = await context.Zones
                    .FirstOrDefaultAsync(z => z.SasUserId == node.Id && z.WorkspaceId == integration.WorkspaceId, cancellationToken);

                if (existingZone != null)
                {
                    // Update existing zone
                    existingZone.Name = node.Username;
                    existingZone.UpdatedAt = DateTime.UtcNow;
                    sasIdToZoneId[node.Id] = existingZone.Id;
                    zoneProgress.ZoneUpdatedRecords++;
                }
                else
                {
                    // Create new zone
                    var newZone = new Zone
                    {
                        Name = node.Username,
                        WorkspaceId = integration.WorkspaceId,
                        SasUserId = node.Id,
                        CreatedAt = DateTime.UtcNow
                    };
                    
                    context.Zones.Add(newZone);
                    await context.SaveChangesAsync(cancellationToken);
                    sasIdToZoneId[node.Id] = newZone.Id;
                    zoneProgress.ZoneNewRecords++;
                }
                
                zoneProgress.ZoneProcessedRecords++;
                if (zoneProgress.ZoneProcessedRecords % 10 == 0)
                {
                    double progress = (zoneProgress.ZoneProcessedRecords / (double)treeNodes.Count) * 2; // 2% progress for first pass
                    await context.SaveChangesAsync(cancellationToken);
                    await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Zones, 51 + (int)progress, 
                        $"Processed {zoneProgress.ZoneProcessedRecords}/{treeNodes.Count} zones...", cancellationToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create/update zone for SAS User ID {SasUserId}", node.Id);
                zoneProgress.ZoneFailedRecords++;
            }
        }

        await context.SaveChangesAsync(cancellationToken);

        // Second pass: Update parent relationships
        await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Zones, 53, "Updating zone hierarchy...", cancellationToken);
        
        foreach (var node in treeNodes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            
            if (node.ParentId.HasValue && sasIdToZoneId.ContainsKey(node.Id))
            {
                var zoneId = sasIdToZoneId[node.Id];
                var zone = await context.Zones.FindAsync(zoneId);
                
                if (zone != null && sasIdToZoneId.ContainsKey(node.ParentId.Value))
                {
                    zone.ParentZoneId = sasIdToZoneId[node.ParentId.Value];
                }
            }
        }

        await context.SaveChangesAsync(cancellationToken);
        await UpdateProgress(syncId, SyncStatus.SyncingUsers, SyncPhase.Zones, 54, 
            $"Zone synchronization complete: {zoneProgress.ZoneProcessedRecords} processed, " +
            $"{zoneProgress.ZoneNewRecords} new, {zoneProgress.ZoneUpdatedRecords} updated, " +
            $"{zoneProgress.ZoneFailedRecords} failed", cancellationToken);
        
        return sasIdToZoneId;
    }

    private async Task UpdateProgress(Guid syncId, SyncStatus status, SyncPhase phase, double percentage, string message, CancellationToken cancellationToken, string? errorMessage = null)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var progress = await context.SyncProgresses.FindAsync(syncId);
        if (progress != null)
        {
            progress.Status = status;
            progress.CurrentPhase = phase;
            progress.ProgressPercentage = percentage;
            progress.CurrentMessage = message;
            progress.ErrorMessage = errorMessage;
            progress.LastUpdatedAt = DateTime.UtcNow;
            
            await context.SaveChangesAsync(cancellationToken);
            await SendProgressUpdateToClients(progress);
        }
    }

    private async Task SendProgressUpdateToClients(SyncProgress progress)
    {
        var update = new SyncProgressUpdate
        {
            SyncId = progress.SyncId,
            IntegrationId = progress.IntegrationId,
            IntegrationName = progress.IntegrationName,
            WorkspaceId = progress.WorkspaceId,
            Status = progress.Status,
            CurrentPhase = progress.CurrentPhase,
            ProfileCurrentPage = progress.ProfileCurrentPage,
            ProfileTotalPages = progress.ProfileTotalPages,
            ProfileTotalRecords = progress.ProfileTotalRecords,
            ProfileProcessedRecords = progress.ProfileProcessedRecords,
            ProfileNewRecords = progress.ProfileNewRecords,
            ProfileUpdatedRecords = progress.ProfileUpdatedRecords,
            ProfileFailedRecords = progress.ProfileFailedRecords,
            GroupCurrentPage = progress.GroupCurrentPage,
            GroupTotalPages = progress.GroupTotalPages,
            GroupTotalRecords = progress.GroupTotalRecords,
            GroupProcessedRecords = progress.GroupProcessedRecords,
            GroupNewRecords = progress.GroupNewRecords,
            GroupUpdatedRecords = progress.GroupUpdatedRecords,
            GroupFailedRecords = progress.GroupFailedRecords,
            ZoneTotalRecords = progress.ZoneTotalRecords,
            ZoneProcessedRecords = progress.ZoneProcessedRecords,
            ZoneNewRecords = progress.ZoneNewRecords,
            ZoneUpdatedRecords = progress.ZoneUpdatedRecords,
            ZoneFailedRecords = progress.ZoneFailedRecords,
            UserCurrentPage = progress.UserCurrentPage,
            UserTotalPages = progress.UserTotalPages,
            UserTotalRecords = progress.UserTotalRecords,
            UserProcessedRecords = progress.UserProcessedRecords,
            UserNewRecords = progress.UserNewRecords,
            UserUpdatedRecords = progress.UserUpdatedRecords,
            UserFailedRecords = progress.UserFailedRecords,
            ProgressPercentage = progress.ProgressPercentage,
            CurrentMessage = progress.CurrentMessage,
            ErrorMessage = progress.ErrorMessage,
            Timestamp = DateTime.UtcNow
        };

        await _hubContext.Clients.Group(progress.SyncId.ToString()).SendAsync("SyncProgress", update);
    }
}

// Helper class for SAS manager tree API response
internal record SasTreeNode
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public int Id { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("parent_id")]
    public int? ParentId { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("username")]
    public string Username { get; init; } = string.Empty;
}

// Helper class for SAS group API response
internal record SasGroupApiResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("current_page")]
    public int CurrentPage { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("data")]
    public List<SasGroup> Data { get; init; } = new();
    
    [System.Text.Json.Serialization.JsonPropertyName("first_page_url")]
    public string? FirstPageUrl { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("from")]
    public int From { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("last_page")]
    public int LastPage { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("last_page_url")]
    public string? LastPageUrl { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("next_page_url")]
    public string? NextPageUrl { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("path")]
    public string? Path { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("per_page")]
    public int PerPage { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("prev_page_url")]
    public string? PrevPageUrl { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("to")]
    public int To { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("total")]
    public int Total { get; init; }
}

internal record SasGroup
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public int Id { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;
    
    [System.Text.Json.Serialization.JsonPropertyName("description")]
    public string? Description { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("users_count")]
    public int UsersCount { get; init; }
    
    [System.Text.Json.Serialization.JsonPropertyName("managers_count")]
    public int ManagersCount { get; init; }
}

