# FreeRADIUS Testing Guide

## Quick Test Commands

### 1. Check FreeRADIUS is running
```bash
docker ps | grep freeradius
```

### 2. Get a test user from the database
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT username, value FROM radcheck WHERE attribute='Cleartext-Password' LIMIT 5;"
```

### 3. Test authentication with radtest
```bash
# Basic syntax:
docker exec freeradius radtest <username> <password> localhost 0 testing123

# Example (replace with actual username/password from step 2):
docker exec freeradius radtest testuser testpass123 localhost 0 testing123
```

**Expected success output:**
```
Sent Access-Request Id <number>
Received Access-Accept Id <number>
```

**Expected failure output:**
```
Sent Access-Request Id <number>
Received Access-Reject Id <number>
```

### 4. Check database tables

**View users in radcheck:**
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT COUNT(*) as user_count FROM radcheck;"
```

**View user attributes:**
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT username, attribute, op, value FROM radcheck LIMIT 10;"
```

**View user-profile assignments:**
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT username, groupname FROM radusergroup LIMIT 10;"
```

**View profile attributes:**
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT groupname, attribute, value FROM radgroupreply LIMIT 10;"
```

### 5. Check FreeRADIUS logs
```bash
# Real-time logs
docker logs freeradius -f

# Last 50 lines
docker logs freeradius --tail 50

# Search for authentication attempts
docker logs freeradius | grep "Auth:"
```

### 6. Test from outside the container (requires radtest on host)
```bash
# If you have FreeRADIUS client tools installed locally:
radtest <username> <password> localhost 1812 testing123
```

### 7. Check accounting records
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT username, acctstarttime, acctstoptime FROM radacct ORDER BY acctstarttime DESC LIMIT 10;"
```

### 8. View NAS (Network Access Server) clients
```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT * FROM nas;"
```

## Troubleshooting

### FreeRADIUS container not starting
```bash
# Check container status
docker ps -a | grep freeradius

# View error logs
docker logs freeradius

# Restart the container
cd FreeRadius
docker-compose restart freeradius
```

### Authentication fails
```bash
# 1. Verify user exists in database
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT * FROM radcheck WHERE username='<username>';"

# 2. Check FreeRADIUS can connect to database
docker exec freeradius cat /etc/raddb/mods-available/sql | grep -A 5 "server ="

# 3. Enable debug mode (edit docker-compose.yml)
# Change: RADIUS_DEBUG=no to RADIUS_DEBUG=yes
# Then restart: docker-compose restart freeradius

# 4. View detailed logs
docker logs freeradius -f
```

### Database connection issues
```bash
# Test database connectivity from FreeRADIUS container
docker exec freeradius ping postgres

# Check if database exists
docker exec openradius-postgres psql -U admin -l | grep openradius_workspace_1

# Verify SQL module is loaded
docker exec freeradius radiusd -C
```

## Create a Test User Manually

If you don't have users yet:

```bash
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 <<EOF
-- Create test user
INSERT INTO radcheck (username, attribute, op, value)
VALUES ('testuser', 'Cleartext-Password', ':=', 'testpass123');

-- Add user to a group (optional)
INSERT INTO radusergroup (username, groupname, priority)
VALUES ('testuser', 'test_group', 1);

-- Add group attributes (optional - speed limits)
INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES 
  ('test_group', 'WISPr-Bandwidth-Max-Down', ':=', '10000'),
  ('test_group', 'WISPr-Bandwidth-Max-Up', ':=', '5000');
EOF
```

Then test:
```bash
docker exec freeradius radtest testuser testpass123 localhost 0 testing123
```

## Run the Automated Test Script

```bash
cd /Users/amohammed/Desktop/CodeMe/openRadius
./scripts/test-freeradius.sh
```

## Expected Results

With the database integration working, you should see:
- ✅ 29+ users synced from RadiusUsers to radcheck
- ✅ 36,000+ user-profile assignments in radusergroup
- ✅ Profile attributes in radgroupreply
- ✅ Successful authentication for valid users
- ✅ Rejection for invalid passwords
