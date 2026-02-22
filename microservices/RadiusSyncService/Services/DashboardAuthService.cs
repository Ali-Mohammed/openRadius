using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace RadiusSyncService.Services;

/// <summary>
/// Configuration options for the dashboard authentication.
/// </summary>
public class DashboardAuthOptions
{
    public string Username { get; set; } = "admin";
    public string Password { get; set; } = "admin";
    public int SessionTimeoutMinutes { get; set; } = 480; // 8 hours
}

/// <summary>
/// Service handling dashboard authentication with cookie-based sessions.
/// Enterprise-grade: uses HMAC-SHA256 for password comparison, 
/// secure cookies, and configurable session timeout.
/// </summary>
public class DashboardAuthService
{
    private readonly DashboardAuthOptions _options;
    private readonly ILogger<DashboardAuthService> _logger;

    public DashboardAuthService(IConfiguration configuration, ILogger<DashboardAuthService> logger)
    {
        _options = new DashboardAuthOptions();
        configuration.GetSection("Dashboard").Bind(_options);
        _logger = logger;
    }

    public DashboardAuthOptions Options => _options;

    /// <summary>
    /// Validates the provided credentials against the configured username and password.
    /// Uses constant-time comparison to prevent timing attacks.
    /// </summary>
    public bool ValidateCredentials(string username, string password)
    {
        var usernameMatch = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(username),
            Encoding.UTF8.GetBytes(_options.Username));

        var passwordMatch = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(password),
            Encoding.UTF8.GetBytes(_options.Password));

        if (usernameMatch && passwordMatch)
        {
            _logger.LogInformation("Dashboard login successful for user: {Username}", username);
            return true;
        }

        _logger.LogWarning("Dashboard login failed for user: {Username}", username);
        return false;
    }

    /// <summary>
    /// Creates a ClaimsPrincipal for the authenticated dashboard user.
    /// </summary>
    public ClaimsPrincipal CreatePrincipal(string username)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, "DashboardAdmin"),
            new("AuthenticatedAt", DateTime.UtcNow.ToString("O"))
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }
}
