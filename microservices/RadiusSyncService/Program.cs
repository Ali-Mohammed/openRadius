using System.Diagnostics;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using RadiusSyncService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure SignalR Hub connection settings
builder.Services.Configure<SignalRHubOptions>(
    builder.Configuration.GetSection("SignalR"));

// Add Docker service for container management
builder.Services.AddSingleton<DockerService>();

// Add Machine Identity service
builder.Services.AddSingleton<MachineIdentityService>();

// Add the SignalR connection service as a hosted service (runs in background)
builder.Services.AddSingleton<SignalRConnectionService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<SignalRConnectionService>());

// Add Dashboard auth service
builder.Services.AddSingleton<DashboardAuthService>();

// Add Connector monitoring service
builder.Services.AddSingleton<ConnectorService>();

// Add health checks
builder.Services.AddHealthChecks();

// Configure cookie authentication for dashboard
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/dashboard/login";
        options.LogoutPath = "/dashboard/logout";
        options.Cookie.Name = "OpenRadius.Edge.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(
            builder.Configuration.GetValue("Dashboard:SessionTimeoutMinutes", 480));
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            // For API calls, return 401 instead of redirect
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.StatusCode = 401;
                return Task.CompletedTask;
            }
            context.Response.Redirect(context.RedirectUri);
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

// Configure CORS for local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

// Health check endpoint (no auth required)
app.MapHealthChecks("/health");

// =============================================================================
// Public endpoints (no auth)
// =============================================================================

// Service info endpoint
app.MapGet("/", () => new
{
    service = "RadiusSyncService",
    version = "1.0.0",
    status = "running",
    dashboard = "/dashboard",
    timestamp = DateTime.UtcNow
});

// Get current SignalR connection status
app.MapGet("/status", (SignalRConnectionService connectionService) => new
{
    service = "RadiusSyncService",
    version = "1.0.0",
    signalRConnected = connectionService.GetConnectionStatus() == "Connected",
    signalRStatus = connectionService.GetConnectionStatus(),
    machineId = app.Services.GetRequiredService<MachineIdentityService>().GetMachineId(),
    uptime = (DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalSeconds,
    timestamp = DateTime.UtcNow
});

// Manual trigger to test sync functionality
app.MapPost("/sync/trigger", async (SignalRConnectionService connectionService, string? syncType) =>
{
    await connectionService.ReportActivity($"Manual sync triggered: {syncType ?? "full"}");
    return Results.Ok(new { message = "Sync triggered", syncType = syncType ?? "full" });
});

// =============================================================================
// Dashboard routes (login/logout — no auth required for GET login page)
// =============================================================================

app.MapGet("/dashboard", (HttpContext ctx) =>
{
    if (ctx.User.Identity?.IsAuthenticated == true)
        return Results.Content(DashboardHtml.GetDashboardPage(), "text/html");
    return Results.Redirect("/dashboard/login");
});

app.MapGet("/dashboard/login", (HttpContext ctx, string? error) =>
{
    if (ctx.User.Identity?.IsAuthenticated == true)
        return Results.Redirect("/dashboard");
    return Results.Content(DashboardHtml.GetLoginPage(error), "text/html");
});

app.MapPost("/dashboard/login", async (HttpContext ctx, DashboardAuthService authService) =>
{
    var form = await ctx.Request.ReadFormAsync();
    var username = form["username"].ToString();
    var password = form["password"].ToString();

    if (authService.ValidateCredentials(username, password))
    {
        var principal = authService.CreatePrincipal(username);
        await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
        return Results.Redirect("/dashboard");
    }

    return Results.Redirect("/dashboard/login?error=Invalid+username+or+password");
});

app.MapGet("/dashboard/logout", async (HttpContext ctx) =>
{
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Redirect("/dashboard/login");
});

// =============================================================================
// Dashboard API endpoints (auth required)
// =============================================================================

var dashboardApi = app.MapGroup("/api/dashboard").RequireAuthorization();

// Service info
dashboardApi.MapGet("/service", (
    MachineIdentityService machineIdentity,
    SignalRConnectionService signalR) =>
{
    var process = Process.GetCurrentProcess();
    return Results.Ok(new
    {
        machineId = machineIdentity.GetMachineId(),
        machineName = machineIdentity.GetMachineName(),
        platform = machineIdentity.GetPlatform(),
        version = "1.0.0",
        dotnetVersion = Environment.Version.ToString(),
        processId = Environment.ProcessId,
        startedAt = process.StartTime.ToUniversalTime(),
        uptimeSeconds = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
        memoryMb = process.WorkingSet64 / (1024.0 * 1024.0),
        threadCount = process.Threads.Count,
        environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
    });
});

// Docker status
dashboardApi.MapGet("/docker", async (DockerService dockerService) =>
{
    var status = await dockerService.GetStatusAsync(forceRefresh: true);
    return Results.Ok(status);
});

// SignalR connection details
dashboardApi.MapGet("/signalr", (SignalRConnectionService signalR) =>
{
    return Results.Ok(signalR.GetDetailedStatus());
});

// Connector status
dashboardApi.MapGet("/connector", async (ConnectorService connectorService) =>
{
    var status = await connectorService.GetConnectorStatusAsync(forceRefresh: true);
    return Results.Ok(status);
});

// Connector actions (deploy, pause, resume, restart)
dashboardApi.MapPost("/connector/{action}", async (
    string action,
    ConnectorService connectorService,
    HttpContext ctx) =>
{
    try
    {
        ConnectorDeployResult result;
        var body = await ctx.Request.ReadFromJsonAsync<ConnectorActionRequest>();
        var connectorName = body?.ConnectorName ?? "jdbc-sink-workspace_1";

        switch (action.ToLower())
        {
            case "deploy":
                result = await connectorService.DeployConnectorAsync();
                break;
            case "pause":
                result = await connectorService.PauseConnectorAsync(connectorName);
                break;
            case "resume":
                result = await connectorService.ResumeConnectorAsync(connectorName);
                break;
            case "restart":
                result = await connectorService.RestartConnectorAsync(connectorName);
                break;
            case "restart-task":
                var taskId = body?.TaskId ?? 0;
                result = await connectorService.RestartTaskAsync(connectorName, taskId);
                break;
            default:
                return Results.BadRequest(new { success = false, message = $"Unknown action: {action}" });
        }

        return Results.Ok(new { success = result.Success, message = result.Message, statusCode = result.StatusCode });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, message = ex.Message });
    }
});

// Container actions
dashboardApi.MapPost("/container/{action}", async (
    string action,
    HttpContext ctx,
    DockerService dockerService) =>
{
    try
    {
        var body = await ctx.Request.ReadFromJsonAsync<ContainerActionRequest>();
        var containerId = body?.ContainerId;

        if (string.IsNullOrEmpty(containerId))
            return Results.BadRequest(new { success = false, message = "containerId is required" });

        CommandResult result;
        switch (action.ToLower())
        {
            case "start":
                result = await dockerService.StartContainerAsync(containerId);
                break;
            case "stop":
                result = await dockerService.StopContainerAsync(containerId);
                break;
            case "restart":
                result = await dockerService.RestartContainerAsync(containerId);
                break;
            case "remove":
                result = await dockerService.RemoveContainerAsync(containerId);
                break;
            default:
                return Results.BadRequest(new { success = false, message = $"Unknown action: {action}" });
        }

        return Results.Ok(new { success = result.Success, message = result.Success ? $"Container {action} successful" : result.Error });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { success = false, message = ex.Message });
    }
});

app.MapControllers();

app.Run();

// Request models
record ContainerActionRequest(string? ContainerId);
record ConnectorActionRequest(string? ConnectorName, int? TaskId);

