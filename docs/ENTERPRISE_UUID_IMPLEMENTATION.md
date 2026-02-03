# Enterprise UUID Implementation

## Overview

This document describes the **enterprise-grade dual-identifier approach** implemented in OpenRadius. The system maintains backward compatibility with integer primary keys while adding UUID support for external APIs, distributed systems, and enhanced security.

## Architecture Decision

### Why Dual Identifiers?

Instead of replacing `int Id` with `Guid Id` (which breaks compatibility), we add a **second identifier**:

```csharp
public class BillingProfile
{
    public int Id { get; set; }           // Primary key - internal use
    public Guid Uuid { get; set; } = Guid.NewGuid();  // Universal identifier - external APIs
    // ... rest of properties
}
```

### Benefits

1. ✅ **Backward Compatibility**: Existing code, APIs, and database relationships continue to work
2. ✅ **Zero Breaking Changes**: No migration of existing data required immediately
3. ✅ **Flexible Migration Path**: Can gradually transition external APIs to use UUIDs
4. ✅ **Security**: UUIDs prevent enumeration attacks and data mining
5. ✅ **Distributed Systems**: UUIDs work better in microservices and replication scenarios
6. ✅ **External Integration**: Partners/webhooks can use UUIDs instead of sequential integers

## Implementation Details

### Backend Models

**Scope**: All application models **except**:
- `RadiusAccounting` (FreeRADIUS core table)
- Any FreeRADIUS core tables (radcheck, radreply, etc.)

**Models Updated** (53 files):
- ✅ All Billing models (BillingProfile, Addon, Automation, etc.)
- ✅ All Radius models (RadiusUser, RadiusProfile, RadiusNas, etc.)
- ✅ All Management models (User, Workspace, Dashboard, etc.)
- ✅ All Network models (OltDevice, SasCardModels, etc.)
- ✅ All Connector models (DebeziumSettings, SyncProgress, etc.)
- ✅ All Payment models

### Database Schema

**Migration**: `Backend/Migrations/add_uuid_columns.sql`

**What it does**:
1. Adds `Uuid uuid NOT NULL DEFAULT gen_random_uuid()` column to all tables
2. Creates index `IX_{TableName}_Uuid` for fast UUID lookups
3. Adds unique constraint `UK_{TableName}_Uuid` to prevent duplicates
4. Skips FreeRADIUS core tables and system tables

**Execution**:
```bash
# Apply to master database
psql -d openradius_master -f Backend/Migrations/add_uuid_columns.sql

# Apply to each tenant database
psql -d tenant_workspace1 -f Backend/Migrations/add_uuid_columns.sql
```

### Backend DTOs

**Updated**: All response DTOs in 52 controller files

```csharp
// Example DTO
public class BillingProfileDto
{
    public int Id { get; set; }        // Keep for internal use
    public Guid Uuid { get; set; }      // New - for external APIs
    public string Name { get; set; }
    // ... rest of properties
}
```

### Frontend TypeScript

**Updated**: 36 API interface files in `Frontend/src/api/`

```typescript
// Example interface
export interface BillingProfile {
  id: number;        // Keep for internal use
  uuid: string;      // New - for external APIs
  name: string;
  // ... rest of properties
}
```

## Usage Patterns

### Internal Operations (Current)

```csharp
// Continue using int Id for internal operations
var profile = await _context.BillingProfiles.FindAsync(id);
```

```typescript
// Frontend can continue using number IDs
const { data } = useBillingProfile(profileId);
```

### External APIs (New - Future)

```csharp
// Public API endpoints can use UUIDs
[HttpGet("public/{uuid:guid}")]
public async Task<ActionResult<BillingProfileDto>> GetByUuid(Guid uuid)
{
    var profile = await _context.BillingProfiles
        .FirstOrDefaultAsync(p => p.Uuid == uuid);
    
    if (profile == null) return NotFound();
    return Ok(profile);
}
```

```typescript
// External integrations can use UUIDs
const profile = await fetch(`/api/public/billing-profiles/${uuid}`);
```

### Migration Strategy

**Phase 1** (Current):
- ✅ Add Uuid properties to all models
- ✅ Add database columns with auto-generated UUIDs
- ✅ Update DTOs and frontend interfaces
- ⏳ Deploy and verify

**Phase 2** (Future):
- Create public API endpoints using UUIDs
- Add UUID-based search/filter endpoints
- Document UUID usage for partners

**Phase 3** (Optional - Long Term):
- Consider deprecating integer IDs in public APIs
- Keep integer IDs for internal database relationships
- Use UUIDs exclusively for external communication

## Database Performance

### Indexing Strategy

```sql
-- Each Uuid column has:
CREATE INDEX "IX_{Table}_Uuid" ON "{Table}" ("Uuid");
CREATE UNIQUE CONSTRAINT "UK_{Table}_Uuid" ON "{Table}" ("Uuid");
```

**Performance Characteristics**:
- UUID lookups: O(log n) via B-tree index
- Integer PK lookups: O(log n) via primary key index
- Storage overhead: 16 bytes per record (UUID) vs 4 bytes (int)
- Acceptable for enterprise applications

## Security Benefits

### Before (Integer IDs)
```
GET /api/billing-profiles/1
GET /api/billing-profiles/2   # Easy to enumerate
GET /api/billing-profiles/3   # Sequential = predictable
```

**Risk**: Attackers can:
- Enumerate all records
- Estimate database size
- Predict new record IDs

### After (UUIDs)
```
GET /api/billing-profiles/550e8400-e29b-41d4-a716-446655440000
GET /api/billing-profiles/7c9e6679-7425-40de-944b-e07fc1f90ae7  # Random
GET /api/billing-profiles/a3bb189e-8bf9-3888-9912-ace4e6543002  # Unpredictable
```

**Security**: 
- 2^122 possible values (collision probability negligible)
- Impossible to enumerate
- Cannot predict future IDs

## Testing Checklist

### Backend Verification
```bash
cd Backend

# 1. Verify build
dotnet build

# 2. Check model files
grep -r "public Guid Uuid" Models/ | wc -l  # Should show 53+ files

# 3. Verify DTOs
grep -r "public Guid Uuid" Controllers/ | wc -l  # Should show many matches
```

### Database Verification
```sql
-- Check Uuid columns exist
SELECT table_name, column_name, data_type 
FROM information_schema.columns
WHERE column_name = 'Uuid'
ORDER BY table_name;

-- Verify UUIDs were generated
SELECT "Id", "Uuid", "Name" FROM "BillingProfiles" LIMIT 5;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_Uuid';

-- Check unique constraints
SELECT constraint_name FROM information_schema.table_constraints 
WHERE constraint_type = 'UNIQUE' AND constraint_name LIKE '%_Uuid%';
```

### Frontend Verification
```bash
cd Frontend

# 1. Check interfaces
grep -r "uuid: string" src/api/ | wc -l  # Should show 36+ files

# 2. Type check (will show pre-existing errors, but no UUID-related errors)
npm run build
```

## Files Modified

### Scripts Created
- ✅ `Backend/add_uuid_property.sh` - Adds Uuid to all models
- ✅ `Backend/add_uuid_to_dtos.sh` - Adds Uuid to all DTOs
- ✅ `Backend/Migrations/add_uuid_columns.sql` - Database migration
- ✅ `Frontend/add_uuid_to_frontend.sh` - Updates TypeScript interfaces

### Backend Files (110+ files)
- ✅ 53 model files in `Backend/Models/`
- ✅ 52 controller files in `Backend/Controllers/`
- ✅ Additional DTO classes in services

### Frontend Files (36 files)
- ✅ All API interface files in `Frontend/src/api/`

## Next Steps

### Immediate
1. ✅ Run database migration on development environment
2. ⏳ Test application functionality
3. ⏳ Verify UUIDs are being generated

### Short Term
1. Create public API endpoints using UUIDs
2. Update API documentation to mention UUID support
3. Add UUID-based filtering/search

### Long Term
1. Partner integration using UUIDs
2. Webhook payload includes UUIDs
3. Consider UUID-only external APIs (keep int IDs internal only)

## Rollback Plan

If needed, rollback is simple:

```bash
# 1. Revert code changes
git reset --hard [previous-commit]

# 2. Remove database columns (if migration was run)
psql -d openradius_master -c "
DO \$\$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
    LOOP
        EXECUTE format('ALTER TABLE \"%I\" DROP COLUMN IF EXISTS \"Uuid\"', table_record.tablename);
    END LOOP;
END \$\$;
"
```

## Conclusion

This dual-identifier approach is the **industry-standard enterprise pattern** used by:
- Stripe (internal IDs + public API IDs)
- GitHub (database IDs + node IDs)
- AWS (internal IDs + ARNs)
- Shopify (integer IDs + global IDs)

It provides:
- ✅ Stability: No breaking changes
- ✅ Security: Non-enumerable identifiers
- ✅ Flexibility: Gradual migration path
- ✅ Performance: Integer primary keys remain optimal for joins
- ✅ Scalability: UUIDs work in distributed systems

**Status**: Implementation complete, ready for testing and database migration.
