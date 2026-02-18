using Backend.Configuration;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers.External;

/// <summary>
/// External API for RADIUS users, authenticated via API key (X-API-Key header).
/// Provides read-only access with filtering and pagination.
/// Route: /api/v1/radius/users
/// </summary>
[ApiController]
[Route("api/v1/radius/users")]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationHandler.SchemeName)]
public class ExternalRadiusUsersController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ExternalRadiusUsersController> _logger;

    public ExternalRadiusUsersController(
        IConfiguration configuration,
        ILogger<ExternalRadiusUsersController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// List RADIUS users with filtering, sorting, and pagination.
    ///
    /// Query Parameters:
    ///   - page (default: 1)
    ///   - limit (default: 25, max: 100)
    ///   - search: free-text search on username, firstname, lastname, email, phone
    ///   - enabled: filter by enabled status (true/false)
    ///   - profileName: filter by profile name (exact match)
    ///   - groupName: filter by group name (exact match)
    ///   - zoneName: filter by zone name (exact match)
    ///   - onlineStatus: filter by online status (online/offline)
    ///   - createdAfter: filter users created after this date (ISO 8601)
    ///   - createdBefore: filter users created before this date (ISO 8601)
    ///   - sortBy: field to sort by (username, createdAt, balance, expiration, lastOnline — default: createdAt)
    ///   - sortDirection: asc or desc (default: desc)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListUsers(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 25,
        [FromQuery] string? search = null,
        [FromQuery] bool? enabled = null,
        [FromQuery] string? profileName = null,
        [FromQuery] string? groupName = null,
        [FromQuery] string? zoneName = null,
        [FromQuery] string? onlineStatus = null,
        [FromQuery] DateTime? createdAfter = null,
        [FromQuery] DateTime? createdBefore = null,
        [FromQuery] string sortBy = "createdAt",
        [FromQuery] string sortDirection = "desc")
    {
        // Validate scope
        if (!HasScope(ApiKeyScopes.RadiusUsersRead))
            return Forbid("API key does not have the 'radius.users.read' scope.");

        // Clamp limit
        if (limit < 1) limit = 1;
        if (limit > 100) limit = 100;
        if (page < 1) page = 1;

        // Resolve workspace-specific database
        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "Could not resolve workspace from API key." });

        using var dbContext = CreateWorkspaceDbContext(workspaceId);
        if (dbContext == null)
            return StatusCode(500, new { message = "Failed to connect to workspace database." });

        // Build query
        var query = dbContext.RadiusUsers
            .Include(u => u.Profile)
            .Include(u => u.RadiusGroup)
            .Include(u => u.Zone)
            .Include(u => u.RadiusUserTags)
                .ThenInclude(ut => ut.RadiusTag)
            .Where(u => !u.IsDeleted)
            .AsQueryable();

        // ── Filters ─────────────────────────────────────────────────

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(u =>
                u.Username.ToLower().Contains(term) ||
                (u.Firstname != null && u.Firstname.ToLower().Contains(term)) ||
                (u.Lastname != null && u.Lastname.ToLower().Contains(term)) ||
                (u.Email != null && u.Email.ToLower().Contains(term)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(term)));
        }

        if (enabled.HasValue)
            query = query.Where(u => u.Enabled == enabled.Value);

        if (!string.IsNullOrWhiteSpace(profileName))
            query = query.Where(u => u.Profile != null && u.Profile.Name == profileName);

        if (!string.IsNullOrWhiteSpace(groupName))
            query = query.Where(u => u.RadiusGroup != null && u.RadiusGroup.Name == groupName);

        if (!string.IsNullOrWhiteSpace(zoneName))
            query = query.Where(u => u.Zone != null && u.Zone.Name == zoneName);

        if (!string.IsNullOrWhiteSpace(onlineStatus))
        {
            if (int.TryParse(onlineStatus, out var onlineStatusInt))
                query = query.Where(u => u.OnlineStatus == onlineStatusInt);
        }

        if (createdAfter.HasValue)
            query = query.Where(u => u.CreatedAt >= createdAfter.Value.ToUniversalTime());

        if (createdBefore.HasValue)
            query = query.Where(u => u.CreatedAt <= createdBefore.Value.ToUniversalTime());

        // ── Sorting ─────────────────────────────────────────────────
        var isDesc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);
        query = sortBy.ToLower() switch
        {
            "username" => isDesc ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
            "balance" => isDesc ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
            "expiration" => isDesc ? query.OrderByDescending(u => u.Expiration) : query.OrderBy(u => u.Expiration),
            "lastonline" => isDesc ? query.OrderByDescending(u => u.LastOnline) : query.OrderBy(u => u.LastOnline),
            "firstname" => isDesc ? query.OrderByDescending(u => u.Firstname) : query.OrderBy(u => u.Firstname),
            "lastname" => isDesc ? query.OrderByDescending(u => u.Lastname) : query.OrderBy(u => u.Lastname),
            "email" => isDesc ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            _ => isDesc ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
        };

        // ── Pagination ──────────────────────────────────────────────
        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)limit);

        var users = await query
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        // ── Map to DTO (UUIDs only, no internal IDs) ────────────────
        var data = users.Select(u => new ExternalRadiusUserDto
        {
            Uuid = u.Uuid,
            Username = u.Username,
            Firstname = u.Firstname,
            Lastname = u.Lastname,
            Email = u.Email,
            Phone = u.Phone,
            Company = u.Company,
            Address = u.Address,
            City = u.City,
            ContractId = u.ContractId,
            StaticIp = u.StaticIp,
            Enabled = u.Enabled,
            Balance = u.Balance,
            LoanBalance = u.LoanBalance,
            Expiration = u.Expiration,
            LastOnline = u.LastOnline,
            OnlineStatus = u.OnlineStatus,
            RemainingDays = u.RemainingDays,
            ProfileName = u.Profile?.Name,
            GroupName = u.RadiusGroup?.Name,
            ZoneName = u.Zone?.Name,
            Tags = u.RadiusUserTags
                .Where(t => t.RadiusTag != null)
                .Select(t => t.RadiusTag!.Title)
                .ToList() ?? new List<string>(),
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
        }).ToList();

        _logger.LogInformation(
            "External API: Listed {Count}/{Total} RADIUS users for workspace {WorkspaceId} (key={KeyUuid})",
            data.Count, totalCount, workspaceId, User.FindFirst("api_key_uuid")?.Value);

        return Ok(new ExternalRadiusUserPagedResponse
        {
            Data = data,
            Page = page,
            Limit = limit,
            TotalCount = totalCount,
            TotalPages = totalPages,
        });
    }

    /// <summary>
    /// Get a single RADIUS user by UUID.
    /// </summary>
    [HttpGet("{uuid:guid}")]
    public async Task<IActionResult> GetByUuid(Guid uuid)
    {
        if (!HasScope(ApiKeyScopes.RadiusUsersRead))
            return Forbid("API key does not have the 'radius.users.read' scope.");

        var workspaceId = GetWorkspaceId();
        if (workspaceId == 0)
            return BadRequest(new { message = "Could not resolve workspace from API key." });

        using var dbContext = CreateWorkspaceDbContext(workspaceId);
        if (dbContext == null)
            return StatusCode(500, new { message = "Failed to connect to workspace database." });

        var user = await dbContext.RadiusUsers
            .Include(u => u.Profile)
            .Include(u => u.RadiusGroup)
            .Include(u => u.Zone)
            .Include(u => u.RadiusUserTags)
                .ThenInclude(ut => ut.RadiusTag)
            .FirstOrDefaultAsync(u => u.Uuid == uuid && !u.IsDeleted);

        if (user == null)
            return NotFound(new { message = "RADIUS user not found." });

        var dto = new ExternalRadiusUserDto
        {
            Uuid = user.Uuid,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            Email = user.Email,
            Phone = user.Phone,
            Company = user.Company,
            Address = user.Address,
            City = user.City,
            ContractId = user.ContractId,
            StaticIp = user.StaticIp,
            Enabled = user.Enabled,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = user.RemainingDays,
            ProfileName = user.Profile?.Name,
            GroupName = user.RadiusGroup?.Name,
            ZoneName = user.Zone?.Name,
            Tags = user.RadiusUserTags
                .Where(t => t.RadiusTag != null)
                .Select(t => t.RadiusTag!.Title)
                .ToList() ?? new List<string>(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
        };

        return Ok(dto);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Private helpers
    // ═════════════════════════════════════════════════════════════════════

    private int GetWorkspaceId()
    {
        var claim = User.FindFirst("api_key_workspace_id")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private bool HasScope(string requiredScope)
    {
        var scopesClaim = User.FindFirst("api_key_scopes")?.Value;

        // If no scopes on the key, it has all scopes (unrestricted key)
        if (string.IsNullOrEmpty(scopesClaim))
            return true;

        var scopes = scopesClaim.Split(',', StringSplitOptions.RemoveEmptyEntries);
        return scopes.Contains(requiredScope, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Creates a workspace-scoped ApplicationDbContext by building the tenant connection string
    /// from the base DefaultConnection and the workspace ID.
    /// </summary>
    private ApplicationDbContext? CreateWorkspaceDbContext(int workspaceId)
    {
        try
        {
            var baseConnection = _configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrEmpty(baseConnection))
                return null;

            // Replace Database name with workspace-specific name
            var parts = baseConnection.Split(';');
            var newParts = parts.Select(part =>
                part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase)
                    ? $"Database=openradius_workspace_{workspaceId}"
                    : part
            );
            var connectionString = string.Join(";", newParts);

            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString);

            return new ApplicationDbContext(optionsBuilder.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create workspace DbContext for workspace {WorkspaceId}", workspaceId);
            return null;
        }
    }
}
