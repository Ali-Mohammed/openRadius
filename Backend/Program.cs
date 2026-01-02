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

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Master PostgreSQL Database (for tenant/instant management)
builder.Services.AddDbContext<MasterDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure Finbuckle.MultiTenant
builder.Services.AddScoped<InstantTenantStore>();
builder.Services.AddScoped<UserInstantTenantResolver>();

builder.Services.AddMultiTenant<InstantTenantInfo>()
    .WithDelegateStrategy(async (IServiceProvider sp) =>
    {
        var resolver = sp.GetRequiredService<UserInstantTenantResolver>();
        var httpContext = sp.GetRequiredService<IHttpContextAccessor>().HttpContext;
        if (httpContext != null)
        {
            var tenantId = await resolver.GetIdentifierAsync(httpContext);
            return tenantId;
        }
        return null;
    })
    .WithStore<InstantTenantStore>(ServiceLifetime.Scoped);

// Configure tenant-specific ApplicationDbContext with MultiTenant support
builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
{
    var accessor = serviceProvider.GetService<IMultiTenantContextAccessor<InstantTenantInfo>>();
    var connectionString = accessor?.MultiTenantContext?.TenantInfo?.ConnectionString 
        ?? builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseNpgsql(connectionString);
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
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = oidcSettings.GetValue<bool>("ValidateAudience", false),
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuers = new[] { 
                oidcSettings["Issuer"] ?? oidcSettings["Authority"] ?? string.Empty 
            },
            ClockSkew = TimeSpan.FromMinutes(5)
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
                Console.WriteLine($"OIDC Token validated for: {context.Principal?.Identity?.Name}");
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

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Initialize master database and seed data
using (var scope = app.Services.CreateScope())
{
    var masterContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
    
    // Ensure master database is created and migrations are applied
    masterContext.Database.Migrate();
    
    // Seed default OIDC provider if no providers exist
    if (!masterContext.OidcSettings.Any())
    {
        masterContext.OidcSettings.Add(new Backend.Models.OidcSettings
        {
            ProviderName = "keycloak",
            DisplayName = "Login with Keycloak",
            Description = "Login using Keycloak OpenID Connect",
            LogoUrl = "/keycloak-logo.svg",
            DisplayOrder = 1,
            Authority = "http://localhost:8080/realms/openradius",
            ClientId = "openradius-web",
            ClientSecret = "",
            RedirectUri = "http://localhost:5173",
            PostLogoutRedirectUri = "http://localhost:5173",
            ResponseType = "code",
            Scope = "openid profile email",
            IsActive = true,
            IsDefault = true,
            RequireHttpsMetadata = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        masterContext.SaveChanges();
        Console.WriteLine("✓ Default Keycloak OIDC provider seeded");
    }
    
    // Ensure all tenant databases exist
    var instants = masterContext.Instants.Where(i => i.DeletedAt == null).ToList();
    foreach (var instant in instants)
    {
        try
        {
            var tenantConnectionString = GetTenantConnectionString(
                builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty,
                instant.Id
            );
            
            var tenantInfo = new InstantTenantInfo
            {
                Id = instant.Id.ToString(),
                Identifier = instant.Name,
                Name = instant.Title,
                ConnectionString = tenantConnectionString,
                InstantId = instant.Id,
                DisplayName = instant.Title,
                Location = instant.Location,
                IsActive = instant.Status == "active"
            };
            
            var tenantDbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(tenantInfo.ConnectionString)
                .Options;
                
            using var tenantContext = new ApplicationDbContext(tenantDbContextOptions);
            tenantContext.Database.Migrate();
            Console.WriteLine($"✓ Tenant database initialized for instant: {instant.Title}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Failed to initialize tenant database for instant {instant.Title}: {ex.Message}");
        }
    }
}

static string GetTenantConnectionString(string baseConnectionString, int instantId)
{
    var parts = baseConnectionString.Split(';');
    var newParts = new List<string>();
    
    foreach (var part in parts)
    {
        if (part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase))
        {
            newParts.Add($"Database=openradius_instant_{instantId}");
        }
        else
        {
            newParts.Add(part);
        }
    }
    
    return string.Join(";", newParts);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

// Add MultiTenant middleware (must be before Authentication)
app.UseMultiTenant();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<SasSyncHub>("/hubs/sassync");

app.Run();
