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

// Add health checks
builder.Services.AddHealthChecks();

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
app.UseHttpsRedirection();

// Health check endpoint
app.MapHealthChecks("/health");

// Service info endpoint
app.MapGet("/", () => new
{
    service = "RadiusSyncService",
    version = "1.0.0",
    status = "running",
    timestamp = DateTime.UtcNow
});

// Get current SignalR connection status
app.MapGet("/status", (SignalRConnectionService connectionService) => new
{
    service = "RadiusSyncService",
    version = "1.0.0",
    signalRStatus = connectionService.GetConnectionStatus(),
    timestamp = DateTime.UtcNow
});

// Manual trigger to test sync functionality
app.MapPost("/sync/trigger", async (SignalRConnectionService connectionService, string? syncType) =>
{
    await connectionService.ReportActivity($"Manual sync triggered: {syncType ?? "full"}");
    return Results.Ok(new { message = "Sync triggered", syncType = syncType ?? "full" });
});

app.MapControllers();

app.Run();
