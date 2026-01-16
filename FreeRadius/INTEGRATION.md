# FreeRADIUS Integration with OpenRadius

This document explains how FreeRADIUS is integrated with the main OpenRadius database.

## Database Integration

FreeRADIUS now connects to the same PostgreSQL database (`openradius`) as the main application, eliminating the need for a separate RADIUS database.

### Configuration Changes

1. **Docker Network**: FreeRADIUS uses the `openradius-network` external network
2. **Database Connection**: Points to `postgres` container with credentials:
   - Host: `postgres`
   - Port: `5432`
   - Database: `openradius`
   - Username: `admin`
   - Password: `admin123`

### Database Schema

The following FreeRADIUS tables are created in the `openradius` database:

- **radcheck** - User authentication credentials
- **radreply** - User-specific reply attributes
- **radgroupcheck** - Group-level check attributes  
- **radgroupreply** - Group-level reply attributes
- **radusergroup** - User-to-group assignments
- **radacct** - Accounting records (session tracking)
- **radpostauth** - Post-authentication logging
- **nas** - NAS client definitions

## Automatic Synchronization

Database triggers automatically sync data between OpenRadius tables and FreeRADIUS tables:

### RadiusUsers → radcheck

When a user is created/updated in `RadiusUsers`:
- Username and password are synced to `radcheck` table
- Cleartext-Password attribute is set
- Framed-Pool is added if user has a profile with a pool
- Entries are removed when user is soft-deleted

### RadiusProfiles → radgroupreply

When a profile is created/updated in `RadiusProfiles`:
- Profile attributes are synced to `radgroupreply` with groupname `profile_{id}`
- WISPr-Bandwidth-Max-Down (download speed in Kbps)
- WISPr-Bandwidth-Max-Up (upload speed in Kbps)
- Framed-Pool (if pool is specified)
- Only enabled profiles are synced

### RadiusUsers + Profiles → radusergroup

When a user's profile is assigned/changed:
- User is automatically added to the profile group in `radusergroup`
- This links the user to their profile's attributes
- Removed when user is deleted or profile is unassigned

### RadiusCustomAttributes → radreply

When custom attributes are created for users:
- User-linked custom attributes are synced to `radreply`
- Only enabled, non-deleted attributes are synced
- Supports custom operator types
- Removed when attribute is disabled or deleted

## Deployment

### First Time Setup

1. Start the main OpenRadius stack:
   ```bash
   cd /Users/amohammed/Desktop/CodeMe/openRadius
   docker-compose up -d
   ```

2. The database initialization will automatically:
   - Create FreeRADIUS tables
   - Create sync triggers
   - Perform initial data sync

3. Start FreeRADIUS:
   ```bash
   cd /Users/amohammed/Desktop/CodeMe/openRadius/FreeRadius
   docker-compose up -d
   ```

### Verify Integration

1. Check that FreeRADIUS can connect to the database:
   ```bash
   docker logs freeradius
   ```

2. Test authentication with a user from OpenRadius:
   ```bash
   docker exec freeradius radtest <username> <password> localhost 0 testing123
   ```

3. Check the radcheck table:
   ```bash
   docker exec -it openradius-postgres psql -U admin -d openradius -c "SELECT * FROM radcheck;"
   ```

### Updating Configuration

If you need to modify the SQL configuration file:

Location: `/Users/amohammed/Desktop/CodeMe/openRadius/FreeRadius/config/mods-available/sql`

Key settings:
- `server = "postgres"` - Points to the postgres service
- `radius_db = "openradius"` - Uses the main database
- Connection pool settings are optimized for ISP deployment

## Manual Sync (if needed)

If triggers fail or you need to re-sync manually:

```sql
-- Connect to database
docker exec -it openradius-postgres psql -U admin -d openradius

-- Re-sync users
TRUNCATE radcheck;
INSERT INTO radcheck (username, attribute, op, value)
SELECT "Username", 'Cleartext-Password', ':=', "Password"
FROM "RadiusUsers"
WHERE "DeletedAt" IS NULL AND "Password" IS NOT NULL;

-- Re-sync profiles
TRUNCATE radgroupreply;
INSERT INTO radgroupreply (groupname, attribute, op, value)
SELECT 'profile_' || "Id"::text, 'WISPr-Bandwidth-Max-Down', ':=', "Downrate"::text
FROM "RadiusProfiles" WHERE "Enabled" = true;

-- Re-sync user-profile assignments  
TRUNCATE radusergroup;
INSERT INTO radusergroup (username, groupname, priority)
SELECT "Username", 'profile_' || "ProfileId"::text, 1
FROM "RadiusUsers"
WHERE "DeletedAt" IS NULL AND "ProfileId" IS NOT NULL;
```

## Troubleshooting

### FreeRADIUS can't connect to database

Check network connectivity:
```bash
docker exec freeradius ping postgres
```

Verify database credentials in:
- `/Users/amohammed/Desktop/CodeMe/openRadius/FreeRadius/config/mods-available/sql`

### Users not authenticating

1. Check if user exists in radcheck:
   ```bash
   docker exec -it openradius-postgres psql -U admin -d openradius -c "SELECT * FROM radcheck WHERE username='<username>';"
   ```

2. Verify trigger is working:
   ```bash
   docker exec -it openradius-postgres psql -U admin -d openradius -c "SELECT * FROM pg_trigger WHERE tgname LIKE 'trigger_sync%';"
   ```

3. Check FreeRADIUS logs:
   ```bash
   docker logs freeradius -f
   ```

### Attributes not applying

1. Check radreply/radgroupreply tables
2. Verify custom attributes are enabled in RadiusCustomAttributes
3. Check trigger execution

## Architecture Benefits

1. **Single Source of Truth**: All data lives in one database
2. **Real-time Sync**: Triggers ensure immediate propagation
3. **No Manual Sync**: Changes automatically reflect in FreeRADIUS
4. **Simplified Backup**: One database to backup
5. **Workspace Isolation**: FreeRADIUS tables can be filtered by workspace if needed
