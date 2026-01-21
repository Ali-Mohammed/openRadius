using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Backend.Hubs;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Finbuckle.MultiTenant.Extensions;
using Finbuckle.MultiTenant.AspNetCore.Extensions;
using OfficeOpenXml;

// Configure EPPlus license for version 8.x - Noncommercial use
ExcelPackage.License.SetNonCommercialPersonal("OpenRadius Development");

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient(); // Add HTTP client for Keycloak API calls
builder.Services.AddMemoryCache(); // Add in-memory caching for tenant info
builder.Services.AddControllers();

// Configure file upload limits
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 524288000; // 500 MB
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Master PostgreSQL Database (for tenant/workspace management)
builder.Services.AddDbContext<MasterDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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

// Add SignalR for real-time sync progress updates
builder.Services.AddSignalR();

// Add HttpClient for SAS API calls
builder.Services.AddHttpClient();

// Add SAS Sync Service
builder.Services.AddScoped<ISasSyncService, SasSyncService>();

// Add FreeRADIUS Log Service
builder.Services.AddScoped<IFreeRadiusLogService, FreeRadiusLogService>();

// Add Microservice Approval Service
builder.Services.AddScoped<MicroserviceApprovalService>();

// Add Kafka Consumer Service for CDC monitoring
builder.Services.AddHostedService<KafkaConsumerService>();

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
    foreach (var workspace in workspaces)
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
            Console.WriteLine($"✓ Tenant database initialized for workspace: {workspace.Title}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Failed to initialize tenant database for workspace {workspace.Title}: {ex.Message}");
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

// Authentication must run first to populate claims
app.UseAuthentication();

// Multi-tenant middleware reads claims from authenticated user
app.UseMultiTenant();

app.UseAuthorization();

app.MapControllers();
app.MapHub<SasSyncHub>("/hubs/sassync");
app.MapHub<CdcHub>("/hubs/cdc");
app.MapHub<LogsHub>("/hubs/logs");
app.MapHub<MicroservicesHub>("/hubs/microservices");

app.Run();

