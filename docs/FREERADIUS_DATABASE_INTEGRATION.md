# FreeRADIUS Database Integration Summary

## Overview
FreeRADIUS has been configured to use the main `openradius` PostgreSQL database instead of running its own separate database.

## Changes Made

### 1. FreeRadius Docker Compose ([FreeRadius/docker-compose.yml](FreeRadius/docker-compose.yml))
- ✅ Removed `radius-postgres` service
- ✅ Removed `radius-postgres-data` volume  
- ✅ Changed network from `radius-network` to `openradius-network` (external)
- ✅ Updated all service network references
- ✅ Removed postgres dependency from freeradius service

### 2. FreeRADIUS SQL Configuration ([FreeRadius/config/mods-available/sql](FreeRadius/config/mods-available/sql))
- ✅ Updated database server: `radius-postgres` → `postgres`
- ✅ Updated database name: `radius` → `openradius`
- ✅ Updated credentials: `radius/radiuspass` → `admin/admin123`

### 3. Main Docker Compose ([docker-compose.yml](docker-compose.yml))
- ✅ Added FreeRADIUS SQL schema mount to postgres service
- ✅ Schema will be automatically applied on first database initialization

### 4. Database Schema ([Backend/Migrations/SQL/001_add_freeradius_tables.sql](Backend/Migrations/SQL/001_add_freeradius_tables.sql))
Created comprehensive FreeRADIUS schema with:
- **8 FreeRADIUS tables**: radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, radacct, radpostauth, nas
- **Automatic sync triggers** that keep FreeRADIUS tables in sync with OpenRadius tables:
  - `RadiusUsers` → `radcheck` (user authentication)
  - `RadiusProfiles` → `radgroupreply` (profile attributes)  
  - `RadiusUsers` + Profiles → `radusergroup` (user-profile assignments)
  - `RadiusCustomAttributes` → `radreply` (custom user attributes)
- **Initial data sync** for existing records

### 5. Documentation
- ✅ Created [FreeRadius/INTEGRATION.md](FreeRadius/INTEGRATION.md) - Complete integration guide
- ✅ Created [scripts/setup-freeradius-db.sh](scripts/setup-freeradius-db.sh) - Manual setup script

## Architecture

```
OpenRadius Application
    ↓
RadiusUsers Table ──────────→ [Trigger] ──→ radcheck Table
RadiusProfiles Table ───────→ [Trigger] ──→ radgroupreply Table
RadiusUsers + Profiles ─────→ [Trigger] ──→ radusergroup Table  
RadiusCustomAttributes ─────→ [Trigger] ──→ radreply Table
    ↓
FreeRADIUS Server (reads from radcheck, radreply, etc.)
```

## Deployment Instructions

### For New Setup

1. **Start main stack** (this creates database with FreeRADIUS tables):
   ```bash
   cd /Users/amohammed/Desktop/CodeMe/openRadius
   docker-compose up -d
   ```

2. **Start FreeRADIUS**:
   ```bash
   cd FreeRadius
   docker-compose up -d
   ```

### For Existing Database

If you already have the database running and need to add FreeRADIUS tables:

```bash
cd /Users/amohammed/Desktop/CodeMe/openRadius
./scripts/setup-freeradius-db.sh
```

## Testing

### 1. Verify Database Connection
```bash
docker exec freeradius ping postgres
```

### 2. Check FreeRADIUS Tables
```bash
docker exec -it openradius-postgres psql -U admin -d openradius -c "SELECT * FROM radcheck LIMIT 5;"
```

### 3. Test Authentication
```bash
# Create a test user in OpenRadius first, then:
docker exec freeradius radtest <username> <password> localhost 0 testing123
```

### 4. Verify Triggers
```bash
docker exec -it openradius-postgres psql -U admin -d openradius -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trigger_sync%';"
```

## Benefits

1. **Single Database** - One PostgreSQL instance for everything
2. **Real-time Sync** - Changes in OpenRadius immediately available to FreeRADIUS
3. **No Manual Sync** - Database triggers handle all synchronization
4. **Simplified Deployment** - One less container to manage
5. **Unified Backup** - One database backup contains everything
6. **Cost Effective** - Reduced resource usage

## Data Flow Examples

### Creating a User
1. User creates account via OpenRadius API/UI
2. Record inserted into `RadiusUsers` table
3. Trigger automatically creates entry in `radcheck` with password
4. If user has a profile, trigger adds entry to `radusergroup`
5. FreeRADIUS can immediately authenticate the user

### Updating Profile Speed Limits
1. Admin updates profile download/upload speed in OpenRadius
2. Record updated in `RadiusProfiles` table  
3. Trigger updates `radgroupreply` with new WISPr bandwidth attributes
4. All users on that profile immediately get new speed limits

### Adding Custom Attributes
1. Admin adds custom RADIUS attribute to a user
2. Record inserted into `RadiusCustomAttributes` table
3. Trigger adds entry to `radreply` for that user
4. FreeRADIUS includes that attribute in RADIUS responses

## Monitoring

### Check Sync Health
```sql
-- Compare counts between OpenRadius and FreeRADIUS tables
SELECT 
  (SELECT COUNT(*) FROM "RadiusUsers" WHERE "DeletedAt" IS NULL) as openradius_users,
  (SELECT COUNT(DISTINCT username) FROM radcheck) as freeradius_users;
```

### View Recent Authentications
```sql
SELECT * FROM radpostauth ORDER BY authdate DESC LIMIT 10;
```

### View Active Sessions
```sql
SELECT * FROM radacct WHERE acctstoptime IS NULL;
```

## Troubleshooting

See [FreeRadius/INTEGRATION.md](FreeRadius/INTEGRATION.md) for detailed troubleshooting steps.

## Files Modified/Created

### Modified
- `/FreeRadius/docker-compose.yml`
- `/FreeRadius/config/mods-available/sql`  
- `/docker-compose.yml`

### Created
- `/Backend/Migrations/SQL/001_add_freeradius_tables.sql`
- `/FreeRadius/INTEGRATION.md`
- `/scripts/setup-freeradius-db.sh`
