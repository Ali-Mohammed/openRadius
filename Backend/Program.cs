using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Backend.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure PostgreSQL
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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

// Seed database with default OIDC provider
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    
    // Ensure database is created and migrations are applied
    context.Database.Migrate();
    
    // Seed default Keycloak provider if no providers exist
    if (!context.OidcSettings.Any())
    {
        context.OidcSettings.Add(new Backend.Models.OidcSettings
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
        context.SaveChanges();
        Console.WriteLine("✓ Default Keycloak OIDC provider seeded");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
