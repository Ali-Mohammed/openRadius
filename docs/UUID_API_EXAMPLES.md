# UUID API Examples

## Current State - Dual Identifier Support

All models now have both `int Id` and `Guid Uuid`. Here are example API responses:

## Example API Responses

### GET /api/billing-profiles

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Premium Package",
  "description": "Our premium offering",
  "price": 99.99,
  "radiusProfileId": 5,
  "billingGroupId": 2,
  "isActive": true,
  "color": "#3b82f6",
  "icon": "Zap",
  "wallets": [],
  "addons": []
}
```

### GET /api/radius/users/{id}

```json
{
  "id": 123,
  "uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "username": "john.doe",
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "balance": 50.00,
  "profileId": 5
}
```

### GET /api/addons

```json
[
  {
    "id": 1,
    "uuid": "a3bb189e-8bf9-3888-9912-ace4e6543002",
    "title": "Extra Data",
    "description": "Additional 10GB data",
    "price": 10.00,
    "isActive": true
  },
  {
    "id": 2,
    "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "title": "Speed Boost",
    "description": "2x faster speeds",
    "price": 15.00,
    "isActive": true
  }
]
```

## Future: UUID-Based Endpoints

Once migration is complete, you can create UUID-based public endpoints:

### Example: Public API for Partners

```csharp
// Backend/Controllers/Public/PublicBillingProfileController.cs
[ApiController]
[Route("api/public/billing-profiles")]
public class PublicBillingProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    
    public PublicBillingProfileController(ApplicationDbContext context)
    {
        _context = context;
    }
    
    // GET: api/public/billing-profiles/{uuid}
    [HttpGet("{uuid:guid}")]
    public async Task<ActionResult<BillingProfileDto>> GetByUuid(Guid uuid)
    {
        var profile = await _context.BillingProfiles
            .Include(p => p.Wallets)
            .Include(p => p.Addons)
            .FirstOrDefaultAsync(p => p.Uuid == uuid && !p.IsDeleted);
        
        if (profile == null)
            return NotFound(new { error = "Profile not found" });
        
        return Ok(new BillingProfileDto
        {
            // Include UUID, exclude internal Id
            Uuid = profile.Uuid,
            Name = profile.Name,
            Description = profile.Description,
            Price = profile.Price,
            IsActive = profile.IsActive,
            Wallets = profile.Wallets.Select(w => new BillingProfileWalletDto
            {
                Uuid = w.Uuid,
                WalletType = w.WalletType,
                Price = w.Price
            }).ToList()
        });
    }
    
    // POST: api/public/billing-profiles/{uuid}/activate
    [HttpPost("{uuid:guid}/activate")]
    public async Task<ActionResult> ActivateProfile(Guid uuid, [FromBody] ActivationRequest request)
    {
        var profile = await _context.BillingProfiles
            .FirstOrDefaultAsync(p => p.Uuid == uuid && !p.IsDeleted);
        
        if (profile == null)
            return NotFound();
        
        // Process activation using UUID
        // ...
        
        return Ok(new { success = true, activationId = Guid.NewGuid() });
    }
}
```

### Example: Webhook Payloads with UUIDs

```json
// POST to partner webhook URL
{
  "event": "billing.profile.activated",
  "timestamp": "2026-02-03T10:30:00Z",
  "data": {
    "profile": {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Premium Package",
      "price": 99.99
    },
    "user": {
      "uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "username": "john.doe",
      "email": "john@example.com"
    },
    "activation": {
      "uuid": "b7d9c3e1-4f2a-8d6c-9a1b-3e5f7c9d1a2b",
      "activatedAt": "2026-02-03T10:30:00Z",
      "expiresAt": "2026-03-03T10:30:00Z"
    }
  }
}
```

## Frontend Usage Examples

### Current: Using Both IDs

```typescript
// Internal operations use number IDs
const { data: profile } = useBillingProfile(profileId);

// Display UUID for support/debugging
<div className="text-xs text-muted-foreground">
  Profile ID: {profile?.uuid}
</div>

// Copy UUID to clipboard for partner sharing
const copyUuid = () => {
  navigator.clipboard.writeText(profile.uuid);
  toast.success("UUID copied to clipboard");
};
```

### Future: UUID-Based Sharing

```typescript
// Share profile via UUID (safe for public URLs)
const shareUrl = `https://app.example.com/public/profile/${profile.uuid}`;

// QR code with UUID
<QRCode value={`openradius://profile/${profile.uuid}`} />

// Deep link with UUID
const deepLink = `myapp://billing-profile?uuid=${profile.uuid}`;
```

## Integration Examples

### Partner API Integration

```typescript
// Partner's integration code
class OpenRadiusClient {
  private apiKey: string;
  private baseUrl: string;
  
  // Get profile by UUID (secure, non-enumerable)
  async getProfile(uuid: string) {
    const response = await fetch(
      `${this.baseUrl}/api/public/billing-profiles/${uuid}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }
  
  // Activate profile by UUID
  async activateProfile(uuid: string, userId: string) {
    const response = await fetch(
      `${this.baseUrl}/api/public/billing-profiles/${uuid}/activate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userUuid: userId })
      }
    );
    return response.json();
  }
}
```

### Mobile App Deep Linking

```swift
// iOS Swift example
func handleDeepLink(url: URL) {
    guard url.scheme == "openradius",
          url.host == "profile",
          let uuid = url.queryParameters["uuid"] else {
        return
    }
    
    // Load profile by UUID
    loadProfile(uuid: uuid)
}
```

## Database Query Examples

### Find by UUID
```sql
-- Fast lookup via indexed UUID
SELECT * FROM "BillingProfiles" 
WHERE "Uuid" = '550e8400-e29b-41d4-a716-446655440000';

-- Join using internal IDs (faster)
SELECT bp.*, rp.* 
FROM "BillingProfiles" bp
JOIN "RadiusProfiles" rp ON bp."RadiusProfileId" = rp."Id"
WHERE bp."Uuid" = '550e8400-e29b-41d4-a716-446655440000';
```

### Bulk Operations
```sql
-- Activate multiple profiles by UUID
UPDATE "BillingProfiles"
SET "IsActive" = true
WHERE "Uuid" = ANY(ARRAY[
  '550e8400-e29b-41d4-a716-446655440000',
  '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  'a3bb189e-8bf9-3888-9912-ace4e6543002'
]::uuid[]);
```

## Best Practices

### ✅ DO

1. **Use UUIDs for external APIs**
   ```csharp
   // Public endpoint
   [HttpGet("public/{uuid:guid}")]
   public async Task<ActionResult> GetPublic(Guid uuid)
   ```

2. **Use int IDs for internal joins**
   ```csharp
   // Internal query - faster with integer FKs
   var profile = await _context.BillingProfiles
       .Include(p => p.RadiusProfile)  // Uses int FK
       .FirstOrDefaultAsync(p => p.Uuid == uuid);
   ```

3. **Include UUIDs in API responses**
   ```csharp
   return Ok(new BillingProfileDto {
       Id = profile.Id,      // Optional: for internal clients
       Uuid = profile.Uuid,  // Always include
       Name = profile.Name
   });
   ```

4. **Use UUIDs in webhooks and events**
   ```json
   { "profileUuid": "550e8400...", "userUuid": "7c9e6679..." }
   ```

### ❌ DON'T

1. **Don't remove int IDs**
   ```csharp
   // ❌ Bad: Breaking change
   public class BillingProfile {
       public Guid Id { get; set; }  // Breaks existing code
   }
   
   // ✅ Good: Keep both
   public class BillingProfile {
       public int Id { get; set; }
       public Guid Uuid { get; set; }
   }
   ```

2. **Don't use UUIDs in high-performance joins**
   ```sql
   -- ❌ Slower: UUID joins
   JOIN ON bp."Uuid" = rp."Uuid"
   
   -- ✅ Faster: Integer joins
   JOIN ON bp."RadiusProfileId" = rp."Id"
   ```

3. **Don't expose sequential IDs publicly**
   ```http
   # ❌ Bad: Enumerable
   GET /api/public/profiles/1
   
   # ✅ Good: Secure
   GET /api/public/profiles/550e8400-e29b-41d4-a716-446655440000
   ```

## Performance Considerations

### Index Performance
```sql
-- UUID lookup: O(log n) - acceptable
EXPLAIN ANALYZE 
SELECT * FROM "BillingProfiles" 
WHERE "Uuid" = '550e8400-e29b-41d4-a716-446655440000';

-- Integer PK lookup: O(log n) - slightly faster
EXPLAIN ANALYZE 
SELECT * FROM "BillingProfiles" 
WHERE "Id" = 1;
```

### Storage Overhead
- **UUID**: 16 bytes per record
- **Integer**: 4 bytes per record
- **Overhead**: 12 bytes per record
- **Impact**: Negligible for most applications

### Index Size
- Additional 16 bytes per record for UUID index
- Acceptable trade-off for security and flexibility

---

**Summary**: Use UUIDs for external APIs and security, keep int IDs for internal performance.
