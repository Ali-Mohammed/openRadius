using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OidcSettingsController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ILogger<OidcSettingsController> _logger;
    private readonly IConfiguration _configuration;

    public OidcSettingsController(
        MasterDbContext context,
        ILogger<OidcSettingsController> logger,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Get all active OIDC providers for login page
    /// </summary>
    [HttpGet("providers")]
    [AllowAnonymous] // Public endpoint for login page
    public async Task<ActionResult<IEnumerable<OidcProviderDto>>> GetActiveProviders()
    {
        try
        {
            var providers = await _context.OidcSettings
                .Where(s => s.IsActive && !s.IsDeleted)
                .OrderBy(s => s.DisplayOrder)
                .ThenBy(s => s.DisplayName)
                .Select(s => new OidcProviderDto
                {
                    Id = s.Id,
                    ProviderName = s.ProviderName,
                    DisplayName = s.DisplayName,
                    Description = s.Description,
                    LogoUrl = s.LogoUrl,
                    DisplayOrder = s.DisplayOrder,
                    Authority = s.Authority,
                    ClientId = s.ClientId,
                    IsDefault = s.IsDefault
                })
                .ToListAsync();

            return Ok(providers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active OIDC providers");
            return StatusCode(500, "Error retrieving OIDC providers");
        }
    }

    /// <summary>
    /// Get a specific OIDC provider by provider name (for dynamic auth)
    /// </summary>
    [HttpGet("provider/{providerName}")]
    [AllowAnonymous]
    public async Task<ActionResult<OidcProviderDto>> GetProviderByName(string providerName)
    {
        try
        {
            var settings = await _context.OidcSettings
                .Where(s => s.ProviderName.ToLower() == providerName.ToLower() && s.IsActive && !s.IsDeleted)
                .Select(s => new OidcProviderDto
                {
                    Id = s.Id,
                    ProviderName = s.ProviderName,
                    DisplayName = s.DisplayName,
                    Description = s.Description,
                    LogoUrl = s.LogoUrl,
                    DisplayOrder = s.DisplayOrder,
                    Authority = s.Authority,
                    ClientId = s.ClientId,
                    IsDefault = s.IsDefault
                })
                .FirstOrDefaultAsync();

            if (settings == null)
            {
                return NotFound($"Provider '{providerName}' not found or inactive");
            }

            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving OIDC provider {ProviderName}", providerName);
            return StatusCode(500, "Error retrieving OIDC provider");
        }
    }

    /// <summary>
    /// Get all OIDC provider configurations
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IEnumerable<OidcSettings>>> GetAllSettings()
    {
        try
        {
            var settings = await _context.OidcSettings
                .OrderBy(s => s.DisplayOrder)
                .ThenByDescending(s => s.UpdatedAt)
                .ToListAsync();

            // Don't return client secrets
            foreach (var setting in settings)
            {
                setting.ClientSecret = null;
            }

            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving OIDC settings");
            return StatusCode(500, "Error retrieving OIDC settings");
        }
    }

    /// <summary>
    /// Get a specific OIDC configuration by ID
    /// </summary>
    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<OidcSettings>> GetSettings(int id)
    {
        try
        {
            var settings = await _context.OidcSettings.FindAsync(id);

            if (settings == null)
            {
                return NotFound();
            }

            // Don't return client secret
            settings.ClientSecret = null;
            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving OIDC settings");
            return StatusCode(500, "Error retrieving OIDC settings");
        }
    }

    /// <summary>
    /// Create new OIDC provider configuration
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<OidcSettings>> CreateSettings([FromBody] OidcSettingsDto dto)
    {
        try
        {
            // Validate required fields
            if (string.IsNullOrWhiteSpace(dto.ProviderName))
            {
                return BadRequest("Provider name is required");
            }
            if (string.IsNullOrWhiteSpace(dto.DisplayName))
            {
                return BadRequest("Display name is required");
            }
            if (string.IsNullOrWhiteSpace(dto.Authority))
            {
                return BadRequest("Authority is required");
            }
            if (string.IsNullOrWhiteSpace(dto.ClientId))
            {
                return BadRequest("ClientId is required");
            }

            // Check if provider name already exists
            var existingProvider = await _context.OidcSettings
                .Where(s => s.ProviderName.ToLower() == dto.ProviderName.ToLower())
                .FirstOrDefaultAsync();

            if (existingProvider != null)
            {
                return BadRequest($"Provider with name '{dto.ProviderName}' already exists");
            }

            // If setting as default, unset other defaults
            if (dto.IsDefault)
            {
                var existingDefaults = await _context.OidcSettings
                    .Where(s => s.IsDefault)
                    .ToListAsync();

                foreach (var existing in existingDefaults)
                {
                    existing.IsDefault = false;
                }
            }

            var settings = new OidcSettings
            {
                ProviderName = dto.ProviderName.ToLower(),
                DisplayName = dto.DisplayName,
                Description = dto.Description,
                LogoUrl = dto.LogoUrl,
                DisplayOrder = dto.DisplayOrder,
                Authority = dto.Authority,
                ClientId = dto.ClientId,
                ClientSecret = dto.ClientSecret,
                RedirectUri = dto.RedirectUri,
                PostLogoutRedirectUri = dto.PostLogoutRedirectUri,
                ResponseType = dto.ResponseType,
                Scope = dto.Scope,
                MetadataAddress = dto.MetadataAddress ?? $"{dto.Authority}/.well-known/openid-configuration",
                RequireHttpsMetadata = dto.RequireHttpsMetadata,
                Issuer = dto.Issuer ?? dto.Authority,
                Audience = dto.Audience,
                ValidateAudience = dto.ValidateAudience,
                IsActive = dto.IsActive,
                IsDefault = dto.IsDefault,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.OidcSettings.Add(settings);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created new OIDC provider {ProviderName} with ID {Id}", settings.ProviderName, settings.Id);

            // Don't return client secret
            settings.ClientSecret = null;
            return CreatedAtAction(nameof(GetSettings), new { id = settings.Id }, settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating OIDC settings");
            return StatusCode(500, "Error creating OIDC settings");
        }
    }

    /// <summary>
    /// Update existing OIDC provider configuration
    /// </summary>
    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSettings(int id, [FromBody] OidcSettingsDto dto)
    {
        try
        {
            var settings = await _context.OidcSettings.FindAsync(id);

            if (settings == null)
            {
                return NotFound();
            }

            // If setting as default, unset other defaults
            if (dto.IsDefault && !settings.IsDefault)
            {
                var existingDefaults = await _context.OidcSettings
                    .Where(s => s.IsDefault && s.Id != id)
                    .ToListAsync();

                foreach (var existing in existingDefaults)
                {
                    existing.IsDefault = false;
                }
            }

            // Update fields
            settings.ProviderName = dto.ProviderName.ToLower();
            settings.DisplayName = dto.DisplayName;
            settings.Description = dto.Description;
            settings.LogoUrl = dto.LogoUrl;
            settings.DisplayOrder = dto.DisplayOrder;
            settings.Authority = dto.Authority;
            settings.ClientId = dto.ClientId;
            if (!string.IsNullOrWhiteSpace(dto.ClientSecret))
            {
                settings.ClientSecret = dto.ClientSecret;
            }
            settings.RedirectUri = dto.RedirectUri;
            settings.PostLogoutRedirectUri = dto.PostLogoutRedirectUri;
            settings.ResponseType = dto.ResponseType;
            settings.Scope = dto.Scope;
            settings.MetadataAddress = dto.MetadataAddress ?? $"{dto.Authority}/.well-known/openid-configuration";
            settings.RequireHttpsMetadata = dto.RequireHttpsMetadata;
            settings.Issuer = dto.Issuer ?? dto.Authority;
            settings.Audience = dto.Audience;
            settings.ValidateAudience = dto.ValidateAudience;
            settings.IsActive = dto.IsActive;
            settings.IsDefault = dto.IsDefault;
            settings.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated OIDC provider {ProviderName} with ID {Id}", settings.ProviderName, id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating OIDC settings");
            return StatusCode(500, "Error updating OIDC settings");
        }
    }

    /// <summary>
    /// Delete OIDC provider configuration (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteSettings(int id)
    {
        try
        {
            var settings = await _context.OidcSettings
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (settings == null)
            {
                return NotFound();
            }

            if (settings.IsDefault)
            {
                return BadRequest(new { message = "Cannot delete the default OIDC provider" });
            }

            settings.IsDeleted = true;
            settings.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Soft deleted OIDC provider {ProviderName} with ID {Id}", settings.ProviderName, id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting OIDC settings");
            return StatusCode(500, "Error deleting OIDC settings");
        }
    }

    /// <summary>
    /// Restore a deleted OIDC provider configuration
    /// </summary>
    [HttpPost("{id}/restore")]
    [Authorize]
    public async Task<IActionResult> RestoreSettings(int id)
    {
        try
        {
            var settings = await _context.OidcSettings
                .FirstOrDefaultAsync(s => s.Id == id && s.IsDeleted);

            if (settings == null)
            {
                return NotFound(new { message = "Deleted provider not found" });
            }

            settings.IsDeleted = false;
            settings.DeletedAt = null;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Restored OIDC provider {ProviderName} with ID {Id}", settings.ProviderName, id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring OIDC settings");
            return StatusCode(500, "Error restoring OIDC settings");
        }
    }

    /// <summary>
    /// Get all deleted OIDC provider configurations
    /// </summary>
    [HttpGet("trash")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<OidcSettings>>> GetDeletedSettings()
    {
        try
        {
            var settings = await _context.OidcSettings
                .Where(s => s.IsDeleted)
                .OrderByDescending(s => s.DeletedAt)
                .ToListAsync();

            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving deleted OIDC settings");
            return StatusCode(500, "Error retrieving deleted OIDC settings");
        }
    }

    /// <summary>
    /// Set a specific OIDC configuration as default
    /// </summary>
    [HttpPut("{id}/set-default")]
    [Authorize]
    public async Task<IActionResult> SetAsDefault(int id)
    {
        try
        {
            var settings = await _context.OidcSettings.FindAsync(id);

            if (settings == null)
            {
                return NotFound();
            }

            // Unset all other defaults
            var existingDefaults = await _context.OidcSettings
                .Where(s => s.IsDefault && s.Id != id)
                .ToListAsync();

            foreach (var existing in existingDefaults)
            {
                existing.IsDefault = false;
            }

            settings.IsDefault = true;
            settings.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Set OIDC provider {ProviderName} ({Id}) as default", settings.ProviderName, id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting OIDC provider as default");
            return StatusCode(500, "Error setting OIDC provider as default");
        }
    }

    /// <summary>
    /// Toggle OIDC configuration active status
    /// </summary>
    [HttpPut("{id}/toggle-active")]
    [Authorize]
    public async Task<IActionResult> ToggleActive(int id)
    {
        try
        {
            var settings = await _context.OidcSettings.FindAsync(id);

            if (settings == null)
            {
                return NotFound();
            }

            settings.IsActive = !settings.IsActive;
            settings.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("{Action} OIDC provider {ProviderName} ({Id})", 
                settings.IsActive ? "Activated" : "Deactivated", settings.ProviderName, id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling OIDC provider active status");
            return StatusCode(500, "Error toggling OIDC provider active status");
        }
    }

    /// <summary>
    /// Test OIDC provider connectivity
    /// </summary>
    [HttpPost("test")]
    [Authorize]
    public async Task<ActionResult<object>> TestConnection([FromBody] OidcSettingsDto dto)
    {
        try
        {
            using var httpClient = new HttpClient();
            var metadataUrl = dto.MetadataAddress ?? $"{dto.Authority}/.well-known/openid-configuration";
            
            var response = await httpClient.GetAsync(metadataUrl);
            
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return Ok(new
                {
                    success = true,
                    message = "Successfully connected to OIDC provider",
                    metadataUrl = metadataUrl,
                    statusCode = (int)response.StatusCode
                });
            }
            else
            {
                return Ok(new
                {
                    success = false,
                    message = "Failed to connect to OIDC provider",
                    metadataUrl = metadataUrl,
                    statusCode = (int)response.StatusCode
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing OIDC connection");
            return Ok(new
            {
                success = false,
                message = $"Error testing connection: {ex.Message}"
            });
        }
    }
}


