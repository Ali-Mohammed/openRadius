namespace Backend.Models;

/// <summary>
/// Represents OIDC (OpenID Connect) provider configuration settings
/// Supports multiple providers: Keycloak, Azure AD, Google, etc.
/// </summary>
public class OidcSettings
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    
    /// <summary>
    /// Provider identifier (keycloak, azuread, google, local)
    /// </summary>
    public string ProviderName { get; set; } = string.Empty;
    
    /// <summary>
    /// Display name shown to users (e.g., "Login with Keycloak")
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;
    
    /// <summary>
    /// Description of the provider
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Logo URL or icon name for the provider
    /// </summary>
    public string? LogoUrl { get; set; }
    
    /// <summary>
    /// Display order on login page
    /// </summary>
    public int DisplayOrder { get; set; } = 0;
    
    /// <summary>
    /// The OIDC Provider Authority URL (e.g., http://localhost:8080/realms/openradius)
    /// </summary>
    public string Authority { get; set; } = string.Empty;
    
    /// <summary>
    /// The Client ID registered with the OIDC provider
    /// </summary>
    public string ClientId { get; set; } = string.Empty;
    
    /// <summary>
    /// The Client Secret for confidential clients
    /// </summary>
    public string? ClientSecret { get; set; }
    
    /// <summary>
    /// Soft delete flag
    /// </summary>
    public bool IsDeleted { get; set; }
    
    /// <summary>
    /// Soft delete timestamp
    /// </summary>
    public DateTime? DeletedAt { get; set; }
    
    /// <summary>
    /// The redirect URI after successful authentication
    /// </summary>
    public string RedirectUri { get; set; } = string.Empty;
    
    /// <summary>
    /// Post logout redirect URI
    /// </summary>
    public string? PostLogoutRedirectUri { get; set; }
    
    /// <summary>
    /// The response type (e.g., "code" for Authorization Code Flow)
    /// </summary>
    public string ResponseType { get; set; } = "code";
    
    /// <summary>
    /// The scope requested from the OIDC provider
    /// </summary>
    public string Scope { get; set; } = "openid profile email";
    
    /// <summary>
    /// The OIDC metadata endpoint URL (.well-known/openid-configuration)
    /// </summary>
    public string? MetadataAddress { get; set; }
    
    /// <summary>
    /// Whether to require HTTPS for metadata retrieval
    /// </summary>
    public bool RequireHttpsMetadata { get; set; } = true;
    
    /// <summary>
    /// The expected issuer value
    /// </summary>
    public string? Issuer { get; set; }
    
    /// <summary>
    /// The expected audience value for token validation
    /// </summary>
    public string? Audience { get; set; }
    
    /// <summary>
    /// Whether to validate the audience claim
    /// </summary>
    public bool ValidateAudience { get; set; } = false;
    
    /// <summary>
    /// Whether this OIDC configuration is currently active and available on login page
    /// Multiple providers can be active simultaneously
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Whether this is the default/primary provider
    /// </summary>
    public bool IsDefault { get; set; } = false;
    
    /// <summary>
    /// Timestamp when the settings were created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Timestamp when the settings were last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// DTO for creating/updating OIDC settings
/// </summary>
public class OidcSettingsDto
{
    public string ProviderName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public string Authority { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string? ClientSecret { get; set; }
    public string RedirectUri { get; set; } = string.Empty;
    public string? PostLogoutRedirectUri { get; set; }
    public string ResponseType { get; set; } = "code";
    public string Scope { get; set; } = "openid profile email";
    public string? MetadataAddress { get; set; }
    public bool RequireHttpsMetadata { get; set; } = true;
    public string? Issuer { get; set; }
    public string? Audience { get; set; }
    public bool ValidateAudience { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;
}

/// <summary>
/// DTO for login page - lightweight provider info
/// </summary>
public class OidcProviderDto
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string ProviderName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public int DisplayOrder { get; set; }
    public string Authority { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}


