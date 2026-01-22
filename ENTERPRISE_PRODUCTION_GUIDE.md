# Enterprise Production Checklist for OpenRadius

## ✅ IMMEDIATE FIXES REQUIRED

### 1. **FIX KEYCLOAK CONFIGURATION** (CRITICAL)
Your Keycloak is NOT sending the `sub` claim - this is a misconfiguration.

**How to Fix:**
1. Go to Keycloak Admin Console: http://localhost:8080
2. Navigate to: **Realms → openradius → Client Scopes → openid**
3. Go to **Mappers** tab
4. Ensure "sub" mapper exists and is enabled:
   - **Name**: sub
   - **Mapper Type**: User Session Note
   - **User Session Note**: sub
   - **Token Claim Name**: sub
   - **Claim JSON Type**: String
   - **Add to ID token**: ON
   - **Add to access token**: ON
   - **Add to userinfo**: ON

**Alternative: Create the mapper if missing:**
```
Name: sub
Protocol: openid-connect
Mapper Type: User Property
Property: id
Token Claim Name: sub
Claim JSON Type: String
Add to ID token: ON
Add to access token: ON
```

### 2. **DATABASE INDEXES** (PERFORMANCE CRITICAL)

The current implementation lacks indexes for user lookups.

**Add to MasterDbContext.cs OnModelCreating:**
```csharp
// Add indexes for performance
modelBuilder.Entity<User>()
    .HasIndex(u => u.Email)
    .HasDatabaseName("IX_Users_Email");

modelBuilder.Entity<User>()
    .HasIndex(u => u.KeycloakUserId)
    .HasDatabaseName("IX_Users_KeycloakUserId");
```

**Create Migration:**
```bash
cd Backend
dotnet ef migrations add AddUserIndexes --context MasterDbContext
dotnet ef database update --context MasterDbContext
```

### 3. **CACHING FOR HEAVY LOAD** (PERFORMANCE)

Add user lookup caching to reduce database queries:

**Backend/Services/CachedUserService.cs:**
```csharp
using Microsoft.Extensions.Caching.Memory;

public class CachedUserService
{
    private readonly MasterDbContext _context;
    private readonly IMemoryCache _cache;
    private const int CACHE_MINUTES = 15;

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        var cacheKey = $"user_email_{email}";
        
        if (!_cache.TryGetValue(cacheKey, out User? user))
        {
            user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == email);
                
            if (user != null)
            {
                _cache.Set(cacheKey, user, TimeSpan.FromMinutes(CACHE_MINUTES));
            }
        }
        
        return user;
    }
    
    public async Task<User?> GetUserByKeycloakIdAsync(string keycloakId)
    {
        var cacheKey = $"user_keycloak_{keycloakId}";
        
        if (!_cache.TryGetValue(cacheKey, out User? user))
        {
            user = await _context.Users
                .FirstOrDefaultAsync(u => u.KeycloakUserId == keycloakId);
                
            if (user != null)
            {
                _cache.Set(cacheKey, user, TimeSpan.FromMinutes(CACHE_MINUTES));
            }
        }
        
        return user;
    }
}
```

### 4. **CONNECTION POOLING** (SCALABILITY)

Update connection strings in appsettings.json:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=openradius;Username=admin;Password=admin123;Pooling=true;Minimum Pool Size=5;Maximum Pool Size=100;Connection Lifetime=0;"
}
```

### 5. **RATE LIMITING** (SECURITY)

Add to Program.cs:
```csharp
using Microsoft.AspNetCore.RateLimiting;

builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.Identity?.Name ?? context.Request.Headers.Host.ToString(),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));
});

// After app.Build()
app.UseRateLimiter();
```

## 📊 LOAD TESTING RECOMMENDATIONS

### Test Scenarios:
1. **Concurrent User Creation**: 1000 simultaneous logins
2. **Workspace Operations**: 100 concurrent workspace creations
3. **API Throughput**: 10,000 requests/minute
4. **Database Connections**: Monitor pool exhaustion

### Tools:
- **Apache JMeter** or **k6.io** for load testing
- **Application Insights** / **New Relic** for monitoring
- **pgBouncer** for PostgreSQL connection pooling

## 🔒 SECURITY HARDENING

### Current Vulnerabilities:
1. ❌ Email-based fallback is less secure than UUID
2. ❌ No request validation/sanitization
3. ❌ Missing rate limiting
4. ❌ No audit logging for security events

### Fixes:
- Enforce `sub` claim presence (remove email fallback after Keycloak fix)
- Add input validation with FluentValidation
- Implement comprehensive audit logging
- Enable HTTPS in production
- Use secrets manager (Azure Key Vault, AWS Secrets Manager)

## 📈 MONITORING & OBSERVABILITY

Add Application Insights or similar:

```csharp
builder.Services.AddApplicationInsightsTelemetry();

// Custom metrics
builder.Services.AddScoped<IMetricsService, MetricsService>();
```

Track:
- User creation/login events
- API response times
- Database query performance
- Cache hit/miss ratios
- Failed authentication attempts

## 🔄 RECOMMENDED ARCHITECTURE CHANGES

### For Heavy Load:

1. **Read Replicas**: Use PostgreSQL read replicas for read-heavy operations
2. **Redis Cache**: Replace in-memory cache with distributed Redis
3. **Message Queue**: Use RabbitMQ/Kafka for async operations
4. **CDN**: Serve static assets via CDN
5. **Load Balancer**: Use NGINX or cloud load balancers

### Scalability Pattern:
```
Internet → Load Balancer → [API Instances] → PostgreSQL Primary
                              ↓                    ↓
                         Redis Cache      PostgreSQL Replicas
                              ↓
                         Message Queue
```

## ✅ CURRENT STATUS

**What's Working:**
- ✅ Email-based user lookup (temporary workaround)
- ✅ User auto-creation
- ✅ Workspace creation
- ✅ Claims transformation

**What Needs Fixing:**
- 🔴 **CRITICAL**: Fix Keycloak `sub` claim
- 🟡 **HIGH**: Add database indexes
- 🟡 **HIGH**: Implement caching
- 🟡 **MEDIUM**: Add DTOs for all responses
- 🟡 **MEDIUM**: Add rate limiting
- 🟢 **LOW**: Enable connection pooling

## 🚀 DEPLOYMENT CHECKLIST

Before production:
- [ ] Fix Keycloak `sub` claim configuration
- [ ] Add database indexes
- [ ] Implement Redis caching
- [ ] Enable connection pooling
- [ ] Add rate limiting
- [ ] Set up monitoring/alerting
- [ ] Load test with expected traffic + 50%
- [ ] Security audit
- [ ] Disaster recovery plan
- [ ] Backup strategy
