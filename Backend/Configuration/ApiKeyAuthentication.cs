using System.Security.Claims;
using System.Text.Encodings.Web;
using Backend.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Backend.Configuration;

/// <summary>
/// ASP.NET Core authentication handler for API key-based authentication.
/// Reads the <c>X-API-Key</c> header and validates the key against the database.
///
/// If valid, the handler creates a <see cref="ClaimsPrincipal"/> with claims for:
///   - <c>api_key_id</c>: internal ID (for recording usage)
///   - <c>api_key_uuid</c>: public UUID
///   - <c>api_key_workspace_id</c>: the workspace the key belongs to
///   - <c>api_key_scopes</c>: comma-separated scopes
///
/// Registered as the "ApiKey" authentication scheme.
/// </summary>
public class ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationOptions>
{
    private readonly IApiKeyService _apiKeyService;
    public const string SchemeName = "ApiKey";
    public const string HeaderName = "X-API-Key";

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<ApiKeyAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IApiKeyService apiKeyService)
        : base(options, logger, encoder)
    {
        _apiKeyService = apiKeyService;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Only handle requests that carry the X-API-Key header
        if (!Request.Headers.TryGetValue(HeaderName, out var headerValue))
            return AuthenticateResult.NoResult();

        var rawKey = headerValue.ToString();
        if (string.IsNullOrWhiteSpace(rawKey))
            return AuthenticateResult.Fail("API key header is empty.");

        var apiKey = await _apiKeyService.ValidateKeyAsync(rawKey);
        if (apiKey == null)
            return AuthenticateResult.Fail("Invalid or expired API key.");

        // Record usage asynchronously (fire-and-forget; don't delay the response)
        var ip = Context.Connection.RemoteIpAddress?.ToString();
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = Context.RequestServices.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<IApiKeyService>();
                await svc.RecordUsageAsync(apiKey.Id, ip);
            }
            catch { /* best-effort */ }
        });

        // Build claims principal
        var claims = new List<Claim>
        {
            new("api_key_id", apiKey.Id.ToString()),
            new("api_key_uuid", apiKey.Uuid.ToString()),
            new("api_key_workspace_id", apiKey.WorkspaceId.ToString()),
            new("api_key_name", apiKey.Name),
        };

        if (!string.IsNullOrEmpty(apiKey.Scopes))
        {
            claims.Add(new Claim("api_key_scopes", apiKey.Scopes));
        }

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}

/// <summary>Options placeholder for the API key authentication scheme.</summary>
public class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions
{
}

/// <summary>
/// Extension methods for configuring API key authentication.
/// </summary>
public static class ApiKeyAuthenticationExtensions
{
    /// <summary>
    /// Adds the "ApiKey" authentication scheme to the authentication builder.
    /// </summary>
    public static AuthenticationBuilder AddApiKeyAuthentication(this AuthenticationBuilder builder)
    {
        return builder.AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(
            ApiKeyAuthenticationHandler.SchemeName, null);
    }
}
