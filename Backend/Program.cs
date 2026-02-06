using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Backend.Hubs;
using Backend.Helpers;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Finbuckle.MultiTenant.Extensions;
using Finbuckle.MultiTenant.AspNetCore.Extensions;
using OfficeOpenXml;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Hangfire;
using Hangfire.PostgreSql;

// Configure EPPlus license for version 8.x - Noncommercial use
ExcelPackage.License.SetNonCommercialPersonal("OpenRadius Development");

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Backend.Controllers.Payments", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .Enrich.WithEnvironmentName()
    .Enrich.WithMachineName()
    .Enrich.WithProperty("Application", "OpenRadius")
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}{NewLine}{Message:lj}{NewLine}{Exception}")
    .WriteTo.File(
        new CompactJsonFormatter(),
        "Logs/openradius-.json",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        fileSizeLimitBytes: 100_000_000)
    .WriteTo.File(
        "Logs/openradius-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz}] [{Level:u3}] {SourceContext}{NewLine}{Message:lj}{NewLine}{Exception}{NewLine}")
    .WriteTo.Seq("http://localhost:5341") // Seq UI
    .CreateLogger();

try
{
    Log.Information("🚀 Starting OpenRadius Payment System");
    Log.Information("Environment: {Environment}", Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production");

var builder = WebApplication.CreateBuilder(args);

// Use Serilog for logging
builder.Host.UseSerilog();

// Add services to the container.
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient(); // Add HTTP client for Keycloak API calls
builder.Services.AddMemoryCache(); // Add in-memory caching for tenant info
builder.Services.AddControllers();

// Add Health Checks
builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("MasterConnection")!,
        name: "master-database",
        tags: new[] { "db", "master" })
    .AddCheck("application", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("Application is running"));

// Configure Payment HTTP Clients with Resilience (Polly)
Backend.Configuration.HttpClientConfiguration.AddPaymentHttpClients(builder.Services);

// Configure Payment Rate Limiting
Backend.Configuration.RateLimitingConfiguration.AddPaymentRateLimiting(builder.Services);

// Configure file upload limits
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 524288000; // 500 MB
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Master PostgreSQL Database (for tenant/workspace management)
builder.Services.AddDbContext<MasterDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("MasterConnection")));

// Configure Finbuckle.MultiTenant
builder.Services.AddScoped<WorkspaceTenantStore>();
builder.Services.AddScoped<UserWorkspaceTenantResolver>();

builder.Services.AddMultiTenant<WorkspaceTenantInfo>()
    .WithStrategy<UserWorkspaceTenantResolver>(ServiceLifetime.Scoped)
    .WithStore<WorkspaceTenantStore>(ServiceLifetime.Scoped);

// Configure tenant-specific ApplicationDbContext with MultiTenant support
builder.Services.AddScoped<ApplicationDbContext>((serviceProvider) =>
{
    var accessor = serviceProvider.GetRequiredService<IMultiTenantContextAccessor<WorkspaceTenantInfo>>();
    var logger = serviceProvider.GetRequiredService<ILogger<ApplicationDbContext>>();
    
    var tenantInfo = accessor?.MultiTenantContext?.TenantInfo;
    var connectionString = tenantInfo?.ConnectionString 
        ?? builder.Configuration.GetConnectionString("DefaultConnection") ?? "";
    
    logger.LogInformation($"ApplicationDbContext: TenantId={tenantInfo?.Id}, WorkspaceId={tenantInfo?.WorkspaceId}, ConnectionString={connectionString}");
    
    var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
    optionsBuilder.UseNpgsql(connectionString);
    
    return new ApplicationDbContext(optionsBuilder.Options);
});

// Configure OIDC Authentication with Keycloak
var oidcSettings = builder.Configuration.GetSection("Oidc");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // OIDC Provider Configuration
        options.Authority = oidcSettings["Authority"] ?? "http://localhost:8080/realms/openradius";
        options.Audience = oidcSettings["Audience"] ?? "openradius-api";
        options.MetadataAddress = oidcSettings["MetadataAddress"] ?? 
            $"{oidcSettings["Authority"]}/.well-known/openid-configuration";
        options.RequireHttpsMetadata = oidcSettings.GetValue<bool>("RequireHttpsMetadata", false);
        
        // Map inbound claims to expected .NET claim types
        options.MapInboundClaims = false; // Disable default claim mapping to keep original claim names
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = oidcSettings.GetValue<bool>("ValidateAudience", false),
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuers = new[] { 
                oidcSettings["Issuer"] ?? oidcSettings["Authority"] ?? string.Empty 
            },
            ClockSkew = TimeSpan.FromMinutes(5),
            NameClaimType = "preferred_username", // Map name claim
            RoleClaimType = "realm_access.roles" // Map role claim
        };
        
        // Enhanced event logging for OIDC authentication
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                Console.WriteLine($"OIDC Authentication failed: {context.Exception.Message}");
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var claims = string.Join(", ", context.Principal?.Claims.Select(c => $"{c.Type}={c.Value}") ?? Array.Empty<string>());
                Console.WriteLine($"OIDC Token validated for: {context.Principal?.Identity?.Name}");
                Console.WriteLine($"OIDC Claims: {claims}");
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Add Claims Transformation for automatic impersonation support
builder.Services.AddScoped<Microsoft.AspNetCore.Authentication.IClaimsTransformation, ImpersonationClaimsTransformation>();

// Add SignalR for real-time sync progress updates
builder.Services.AddSignalR();

// Add HttpClient for SAS API calls
builder.Services.AddHttpClient();

// Add SAS Sync Service
builder.Services.AddScoped<ISasSyncService, SasSyncService>();

// Add Session Sync Service
builder.Services.AddScoped<ISessionSyncService, SessionSyncService>();

// Add FreeRADIUS Log Service
builder.Services.AddScoped<IFreeRadiusLogService, FreeRadiusLogService>();

// Add RADIUS Tag Sync Service
builder.Services.AddScoped<IRadiusTagSyncService, RadiusTagSyncService>();

// Add Microservice Approval Service
builder.Services.AddScoped<MicroserviceApprovalService>();

// Add Payment Services
builder.Services.AddScoped<PaymentAuditService>();

// Add Workspace Job Service for per-workspace background jobs
builder.Services.AddScoped<IWorkspaceJobService, WorkspaceJobService>();
builder.Services.AddScoped<IExampleJobService, ExampleJobService>();

// Add SAS Activation Service
builder.Services.AddScoped<ISasActivationService, SasActivationService>();

// Add Kafka Consumer Service for CDC monitoring
builder.Services.AddHostedService<KafkaConsumerService>();

// Configure Hangfire for each workspace (per-tenant job processing)
builder.Services.AddHangfire(config =>
{
    // Hangfire will be configured per-workspace using the workspace's PostgreSQL database
    // This is a placeholder configuration - actual connection will be set at runtime
    var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");
    config.UsePostgreSqlStorage(c => c.UseNpgsqlConnection(defaultConnection));
    config.UseSerializerSettings(new Newtonsoft.Json.JsonSerializerSettings
    {
        TypeNameHandling = Newtonsoft.Json.TypeNameHandling.Auto
    });
});

// Hangfire server will be configured after database initialization
// to dynamically discover all workspace and integration queues

// Configure CORS
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:5173", "http://localhost:5174" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Kestrel server options for large file uploads
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 524288000; // 500 MB
});

var app = builder.Build();

// Initialize master database and seed data
using (var scope = app.Services.CreateScope())
{
    var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
    
    // Ensure master database is created and migrations are applied
    masterContext.Database.Migrate();
    
    // Seed roles, permissions, and groups
    SeedData.Initialize(masterContext);
    
    // Seed default OIDC provider if no providers exist
    if (!masterContext.OidcSettings.Any())
    {
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var oidcConfig = configuration.GetSection("Oidc");
        
        masterContext.OidcSettings.Add(new Backend.Models.OidcSettings
        {
            ProviderName = "keycloak",
            DisplayName = "Login with Keycloak",
            Description = "Login using Keycloak OpenID Connect",
            LogoUrl = "/keycloak-logo.svg",
            DisplayOrder = 1,
            Authority = oidcConfig["Authority"] ?? "http://localhost:8080/realms/openradius",
            ClientId = oidcConfig["ClientId"] ?? "openradius-web",
            ClientSecret = oidcConfig["ClientSecret"] ?? "",
            RedirectUri = oidcConfig["RedirectUri"] ?? "http://localhost:5173",
            PostLogoutRedirectUri = oidcConfig["PostLogoutRedirectUri"] ?? "http://localhost:5173",
            ResponseType = oidcConfig["ResponseType"] ?? "code",
            Scope = oidcConfig["Scope"] ?? "openid profile email",
            IsActive = true,
            IsDefault = true,
            RequireHttpsMetadata = oidcConfig.GetValue<bool>("RequireHttpsMetadata", false),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        masterContext.SaveChanges();
        Console.WriteLine("✓ Default Keycloak OIDC provider seeded");
    }
    
    // Ensure all tenant databases exist
    var workspaces = masterContext.Workspaces.Where(i => i.DeletedAt == null).ToList();
    foreach (var workspace in workspaces.Where(w => w.DeletedAt == null))
    {
        try
        {
            var tenantConnectionString = GetTenantConnectionString(
                builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty,
                workspace.Id
            );
            
            var tenantInfo = new WorkspaceTenantInfo
            {
                Id = workspace.Id.ToString(),
                Identifier = workspace.Name,
                Name = workspace.Title,
                ConnectionString = tenantConnectionString,
                WorkspaceId = workspace.Id,
                DisplayName = workspace.Title,
                Location = workspace.Location,
                IsActive = workspace.Status == "active"
            };
            
            var tenantDbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(tenantInfo.ConnectionString)
                .Options;
                
            using var tenantContext = new ApplicationDbContext(tenantDbContextOptions);
            tenantContext.Database.Migrate();
            
            // Configure Hangfire for this workspace
            GlobalConfiguration.Configuration.UsePostgreSqlStorage(c => 
                c.UseNpgsqlConnection(tenantInfo.ConnectionString),
                new PostgreSqlStorageOptions
                {
                    SchemaName = "hangfire"
                });
            
            Console.WriteLine($"✓ Tenant database initialized for workspace: {workspace.Title}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Failed to initialize tenant database for workspace {workspace.Title}: {ex.Message}");
        }
    }
    
    // Dynamically build queue list for Hangfire server
    var queues = new List<string> { "default" };
    foreach (var workspace in workspaces.Where(w => w.DeletedAt == null))
    {
        // Add workspace-level queue
        queues.Add($"workspace_{workspace.Id}");
        
        // Add integration-specific queues for this workspace
        try
        {
            var tenantConnectionString = GetTenantConnectionString(
                builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty,
                workspace.Id
            );
            
            var tenantDbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(tenantConnectionString)
                .Options;
                
            using var tenantContext = new ApplicationDbContext(tenantDbContextOptions);
            
            // Get all integrations for this workspace
            var integrations = tenantContext.SasRadiusIntegrations
                .Where(i => !i.IsDeleted)
                .Select(i => new { i.Id, i.ActivationMaxConcurrency })
                .ToList();
                
            foreach (var integration in integrations)
            {
                // Only add integration-specific queue if using sequential processing
                if (integration.ActivationMaxConcurrency == 1)
                {
                    queues.Add($"workspace_{workspace.Id}_integration_{integration.Id}");
                }
            }
            
            Console.WriteLine($"✓ Discovered {integrations.Count} integrations for workspace {workspace.Title}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Failed to discover integrations for workspace {workspace.Title}: {ex.Message}");
        }
    }
    
    // Start Hangfire servers for each workspace database
    // Each workspace has jobs stored in its own database, so we need one server per workspace
    app.Services.GetRequiredService<IServiceProvider>().GetService<IRecurringJobManager>();
    
    var hangfireServers = new List<BackgroundJobServer>();
    foreach (var workspace in workspaces.Where(w => w.DeletedAt == null))
    {
        try
        {
            var tenantConnectionString = GetTenantConnectionString(
                builder.Configuration.GetConnectionString("DefaultConnection")!,
                workspace.Id
            );
            
            // Create workspace-specific storage
            var storage = new PostgreSqlStorage(tenantConnectionString, new PostgreSqlStorageOptions
            {
                SchemaName = "hangfire"
            });
            
            // Get queues for this workspace
            var workspaceQueues = queues
                .Where(q => q.StartsWith($"workspace_{workspace.Id}") || q == "default")
                .ToArray();
            
            var serverOptions = new BackgroundJobServerOptions
            {
                WorkerCount = Math.Max(2, Environment.ProcessorCount / workspaces.Count),
                ServerName = $"OpenRadius-{Environment.MachineName}-W{workspace.Id}",
                Queues = workspaceQueues
            };
            
            Console.WriteLine($"🔄 Starting Hangfire server for workspace {workspace.Id} with {workspaceQueues.Length} queues: {string.Join(", ", workspaceQueues)}");
            
            // Create and start a background job server for this workspace
            var server = new BackgroundJobServer(serverOptions, storage);
            hangfireServers.Add(server);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Failed to start Hangfire server for workspace {workspace.Id}: {ex.Message}");
        }
    }
    
    // Register recurring jobs for integrations with sync enabled
    Console.WriteLine("🔄 Registering recurring jobs for online user sync...");
    foreach (var workspace in workspaces.Where(w => w.DeletedAt == null))
    {
        try
        {
            var tenantConnectionString = GetTenantConnectionString(
                builder.Configuration.GetConnectionString("DefaultConnection")!,
                workspace.Id
            );
            
            using var jobScope = app.Services.CreateScope();
            var dbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(tenantConnectionString)
                .Options;
            
            using var context = new ApplicationDbContext(dbContextOptions, null!);
            
            // Find all integrations with sync enabled
            var integrationsWithSync = await context.SasRadiusIntegrations
                .Where(i => i.SyncOnlineUsers && i.IsActive && !i.IsDeleted)
                .ToListAsync();
            
            if (integrationsWithSync.Any())
            {
                var storage = new PostgreSqlStorage(tenantConnectionString, new PostgreSqlStorageOptions
                {
                    SchemaName = "hangfire"
                });
                
                var recurringJobManager = new RecurringJobManager(storage);
                
                foreach (var integration in integrationsWithSync)
                {
                    var jobId = $"workspace_{workspace.Id}_sync-online-users-{integration.Id}";
                    var cronExpression = $"*/{integration.SyncOnlineUsersIntervalMinutes} * * * *";
                    
                    recurringJobManager.AddOrUpdate<ISasSyncService>(
                        jobId,
                        service => service.SyncOnlineUsersAsync(integration.Id, workspace.Id, tenantConnectionString),
                        cronExpression,
                        new RecurringJobOptions
                        {
                            TimeZone = TimeZoneInfo.Utc
                        });
                    
                    Console.WriteLine($"  ✓ Registered job '{jobId}' for integration '{integration.Name}' (every {integration.SyncOnlineUsersIntervalMinutes} min)");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  ✗ Failed to register jobs for workspace {workspace.Id}: {ex.Message}");
        }
    }
}

static string GetTenantConnectionString(string baseConnectionString, int WorkspaceId)
{
    var parts = baseConnectionString.Split(';');
    var newParts = new List<string>();
    
    foreach (var part in parts)
    {
        if (part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase))
        {
            newParts.Add($"Database=openradius_workspace_{WorkspaceId}");
        }
        else
        {
            newParts.Add(part);
        }
    }
    
    return string.Join(";", newParts);
}

// Configure the HTTP request pipeline.

// CORS must be before authentication/authorization
app.UseCors("AllowFrontend");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Rate limiting should be early in the pipeline
app.UseRateLimiter();

// Authentication must run first to populate claims
app.UseAuthentication();

// Multi-tenant middleware reads claims from authenticated user
app.UseMultiTenant();

app.UseAuthorization();

// Configure Hangfire Dashboard with authentication
// Create a dashboard for each workspace so you can view workspace-specific jobs
using (var scope = app.Services.CreateScope())
{
    var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
    var activeWorkspaces = masterContext.Workspaces.Where(w => w.DeletedAt == null).ToList();
    
    foreach (var workspace in activeWorkspaces)
    {
        var workspaceConnection = GetTenantConnectionString(
            builder.Configuration.GetConnectionString("DefaultConnection")!,
            workspace.Id
        );
        var workspaceStorage = new PostgreSqlStorage(workspaceConnection, new PostgreSqlStorageOptions
        {
            SchemaName = "hangfire"
        });
        
        // Create a route for each workspace: /hangfire/workspace/1, /hangfire/workspace/2, etc.
        app.UseHangfireDashboard($"/hangfire/workspace/{workspace.Id}", new DashboardOptions
        {
            Authorization = new[] { new HangfireAuthorizationFilter() },
            DashboardTitle = $"OpenRadius Jobs - {workspace.Name ?? workspace.Title} (Workspace {workspace.Id})",
            DisplayStorageConnectionString = false,
            AppPath = null
        }, workspaceStorage);
        
        Console.WriteLine($"📊 Hangfire dashboard available at: /hangfire/workspace/{workspace.Id} ({workspace.Name ?? workspace.Title})");
    }
}

// Also create a default dashboard pointing to workspace 1 for convenience
var workspace1Connection = GetTenantConnectionString(
    builder.Configuration.GetConnectionString("DefaultConnection")!,
    1
);
var dashboardStorage = new PostgreSqlStorage(workspace1Connection, new PostgreSqlStorageOptions
{
    SchemaName = "hangfire"
});
JobStorage.Current = dashboardStorage;

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAuthorizationFilter() },
    DashboardTitle = "OpenRadius Jobs - Workspace 1 (Default)",
    DisplayStorageConnectionString = false,
    AppPath = null
}, dashboardStorage);

Console.WriteLine($"📊 Default Hangfire dashboard at: /hangfire (points to Workspace 1)");

app.MapControllers();
app.MapHealthChecks("/health");
app.MapHub<SasSyncHub>("/hubs/sassync");
app.MapHub<CdcHub>("/hubs/cdc");
app.MapHub<LogsHub>("/hubs/logs");
app.MapHub<TagSyncHub>("/hubs/tagsync");
app.MapHub<MicroservicesHub>("/hubs/microservices").AllowAnonymous();

// Add Serilog request logging
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
        diagnosticContext.Set("UserAgent", httpContext.Request.Headers["User-Agent"].ToString());
        diagnosticContext.Set("RemoteIP", httpContext.Connection.RemoteIpAddress?.ToString());
    };
});

Log.Information("✅ OpenRadius Payment System started successfully");
Log.Information("📊 Seq Log UI available at: http://localhost:5341");
Log.Information("📁 Log files location: Logs/");

app.Run();

}
catch (Exception ex)
{
    Log.Fatal(ex, "💥 Application terminated unexpectedly");
    throw;
}
finally
{
    Log.Information("🛑 Shutting down OpenRadius Payment System");
    Log.CloseAndFlush();
}

