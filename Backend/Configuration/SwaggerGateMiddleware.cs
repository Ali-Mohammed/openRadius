using Backend.Services;

namespace Backend.Configuration;

/// <summary>
/// Middleware that conditionally gates access to Swagger endpoints
/// based on the SystemSettings "SwaggerEnabled" value in the database.
///
/// When the setting is disabled (or missing), requests to /swagger/* return 404.
/// The setting value is read through <see cref="ISystemSettingsService"/>
/// which uses IMemoryCache (5 min TTL) to avoid per-request DB hits.
///
/// Pipeline position: BEFORE UseSwagger() and UseSwaggerUI().
/// </summary>
public class SwaggerGateMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SwaggerGateMiddleware> _logger;

    public SwaggerGateMiddleware(RequestDelegate next, ILogger<SwaggerGateMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/swagger"))
        {
            try
            {
                var settingsService = context.RequestServices.GetRequiredService<ISystemSettingsService>();
                var isEnabled = await settingsService.GetBoolSettingAsync("SwaggerEnabled", defaultValue: false);

                if (!isEnabled)
                {
                    _logger.LogDebug("Swagger request blocked — SwaggerEnabled is false. Path: {Path}", context.Request.Path);
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync("{\"error\":\"Not Found\"}");
                    return;
                }
            }
            catch (Exception ex)
            {
                // If the SystemSettings table doesn't exist yet (pending migration)
                // or the database is unreachable, allow Swagger through rather than
                // returning 500. This prevents a chicken-and-egg problem during first deploy.
                _logger.LogWarning(ex, "SwaggerGateMiddleware: failed to read SwaggerEnabled setting — allowing Swagger through");
            }
        }

        await _next(context);
    }
}

public static class SwaggerGateMiddlewareExtensions
{
    public static IApplicationBuilder UseSwaggerGate(this IApplicationBuilder app)
    {
        return app.UseMiddleware<SwaggerGateMiddleware>();
    }
}
