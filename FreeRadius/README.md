# FreeRADIUS 3.2 Enterprise ISP Deployment

This directory contains a production-ready FreeRADIUS 3.2 deployment optimized for enterprise ISP operations, featuring PostgreSQL backend storage and Redis caching for high performance.

## Architecture

### Components

1. **FreeRADIUS 3.2 Server**
   - Alpine-based container for minimal footprint
   - Configured with PostgreSQL SQL module
   - Redis caching for session and authentication data
   - Custom VSA (Vendor Specific Attributes) support
   - Multi-threaded for high concurrency

2. **PostgreSQL Database**
   - Dedicated RADIUS database with optimized schema
   - Connection pooling (3-32 connections)
   - Indexes on critical lookup fields
   - Accounting data retention
   - NAS client management

3. **Redis Cache**
   - Multiple database instances for different cache types:
     - DB 0: General caching
     - DB 1: Session cache (24h TTL)
     - DB 2: Authentication cache (1h TTL)
     - DB 3: Rate limiting (5min TTL)
   - LRU eviction policy with 512MB memory limit
   - Persistence with AOF (Append-Only File)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Port availability: 1812/udp, 1813/udp, 18120/tcp, 5433/tcp, 6380/tcp

### Start Services

```bash
cd FreeRadius
docker-compose up -d
```

### Verify Services

Check service health:
```bash
docker-compose ps
```

View FreeRADIUS logs:
```bash
docker-compose logs -f freeradius
```

### Test Authentication

Test with radtest (from host machine, requires freeradius-utils):
```bash
# Install radtest tool
# Ubuntu/Debian: sudo apt-get install freeradius-utils
# macOS: brew install freeradius-server

# Test authentication
radtest testuser testpassword localhost:1812 0 testing123
```

Test from within container:
```bash
docker exec -it freeradius radtest test test localhost 0 testing123
```

## Configuration

### Database Connection

PostgreSQL settings in `config/mods-available/sql`:
- Host: radius-postgres (internal Docker network)
- Port: 5432
- Database: radius
- User: radius
- Password: radiuspass

To change credentials, update:
1. `docker-compose.yml` environment variables
2. `config/mods-available/sql` connection details

### Redis Configuration

Redis settings in `config/mods-available/redis`:
- Host: radius-redis
- Port: 6379
- Connection pool: 3-32 connections per instance
- Multiple database instances for cache separation

### NAS Clients

Add your NAS (Network Access Server) devices in `config/clients.conf`:

```conf
client my-nas {
    ipaddr = 192.168.1.1
    secret = your-strong-secret-key
    shortname = nas1
    nas_type = cisco
    require_message_authenticator = yes
    limit {
        max_connections = 100
        idle_timeout = 600
    }
}
```

For network ranges:
```conf
client private-network {
    ipaddr = 10.0.0.0/8
    secret = shared-secret
    shortname = private-net
}
```

### Custom Attributes

Custom VSA attributes are defined in `config/dictionary`:

```
# Bandwidth management
Custom-Download-Speed - Download speed in Kbps
Custom-Upload-Speed - Upload speed in Kbps
Custom-Bandwidth-Profile - Bandwidth profile name

# Subscriber management
Custom-Subscriber-ID - Unique subscriber identifier
Custom-Package-Name - Service package name
Custom-Account-Status - Account status (Active/Suspended/Expired)

# QoS
Custom-QoS-Profile - Quality of Service profile
Custom-Priority-Level - Traffic priority (Low/Medium/High/Critical)
```

## Database Schema

### Core Tables

- **radcheck**: User authentication credentials
- **radreply**: User-specific reply attributes
- **radgroupcheck**: Group-level check attributes
- **radgroupreply**: Group-level reply attributes
- **radusergroup**: User-to-group assignments
- **radacct**: Accounting records (session tracking)
- **radpostauth**: Post-authentication logging
- **nas**: NAS client definitions

### Adding Users

Insert directly into PostgreSQL:

```sql
-- Connect to database
docker exec -it radius-postgres psql -U radius -d radius

-- Add user with password
INSERT INTO radcheck (username, attribute, op, value)
VALUES ('john@example.com', 'Cleartext-Password', ':=', 'secret123');

-- Add download speed limit
INSERT INTO radreply (username, attribute, op, value)
VALUES ('john@example.com', 'Custom-Download-Speed', ':=', '10000');

-- Add to group
INSERT INTO radusergroup (username, groupname, priority)
VALUES ('john@example.com', 'premium', 1);
```

## Performance Tuning

### FreeRADIUS Settings (`config/radiusd.conf`)

- **max_requests**: 16384 (concurrent request limit)
- **Thread pool**: 5-32 servers with dynamic scaling
- **max_request_time**: 30 seconds
- **cleanup_delay**: 5 seconds

### PostgreSQL Connection Pool

Configure in `config/mods-available/sql`:
```
pool {
    start = 5        # Initial connections
    min = 3          # Minimum connections
    max = 32         # Maximum connections
    spare = 10       # Spare connections
    idle_timeout = 60
}
```

### Redis Memory Management

Redis is configured with:
- 512MB memory limit
- LRU eviction policy
- AOF persistence for durability

Adjust in `docker-compose.yml`:
```yaml
command: redis-server --maxmemory 1024mb --maxmemory-policy allkeys-lru
```

## Monitoring

### View Logs

FreeRADIUS logs:
```bash
docker-compose logs -f freeradius
tail -f logs/radius.log
```

PostgreSQL logs:
```bash
docker-compose logs -f radius-postgres
```

Redis logs:
```bash
docker-compose logs -f radius-redis
```

### Check Cache Performance

Connect to Redis:
```bash
docker exec -it radius-redis redis-cli

# View cache statistics
INFO stats

# Monitor commands in real-time
MONITOR

# Check session cache (DB 1)
SELECT 1
KEYS *
```

### Query Active Sessions

```bash
docker exec -it radius-postgres psql -U radius -d radius

SELECT username, acctsessionid, nasipaddress, acctstarttime, 
       framedipaddress, acctinputoctets, acctoutputoctets
FROM radacct
WHERE acctstoptime IS NULL
ORDER BY acctstarttime DESC;
```

## Production Considerations

### Security

1. **Change default passwords** in docker-compose.yml
2. **Use strong NAS secrets** (minimum 20 characters)
3. **Enable TLS** for PostgreSQL connections
4. **Firewall rules**: Restrict access to ports 1812, 1813, 5433, 6380
5. **Regular security updates**: Update Docker images periodically

### High Availability

For production HA setup:
1. Deploy multiple FreeRADIUS instances behind load balancer
2. Use PostgreSQL replication (primary/replica)
3. Redis Sentinel or Redis Cluster for cache HA
4. Shared storage for configuration files

### Backup

Backup PostgreSQL data:
```bash
docker exec radius-postgres pg_dump -U radius radius > backup-$(date +%Y%m%d).sql
```

Restore from backup:
```bash
docker exec -i radius-postgres psql -U radius radius < backup-20250113.sql
```

### Monitoring & Alerting

Integrate with:
- Prometheus + Grafana for metrics
- ELK Stack for log aggregation
- Nagios/Zabbix for service monitoring

## Integration with OpenRadius Application

This FreeRADIUS setup can integrate with your main OpenRadius application:

1. **Share PostgreSQL**: Point FreeRADIUS to your main `openradius` database
2. **User Sync**: Sync RadiusUsers table to FreeRADIUS radcheck table
3. **Attribute Sync**: Map RadiusCustomAttributes to radreply table
4. **Profile Sync**: Map RadiusProfiles to radgroupreply table

Example sync query:
```sql
-- Sync users from openradius.RadiusUsers to radius.radcheck
INSERT INTO radius.radcheck (username, attribute, op, value)
SELECT "Username", 'Cleartext-Password', ':=', "Password"
FROM openradius."RadiusUsers"
WHERE "IsDeleted" = false
ON CONFLICT (username, attribute) DO UPDATE
SET value = EXCLUDED.value;
```

## Troubleshooting

### FreeRADIUS won't start

Check configuration syntax:
```bash
docker exec freeradius radiusd -X
```

### Authentication failures

1. Check user exists in radcheck table
2. Verify NAS client secret in clients.conf
3. Enable debug mode: Set `auth_badpass = yes` in radiusd.conf
4. Check logs: `tail -f logs/radius.log`

### Database connection errors

1. Verify PostgreSQL is running: `docker ps`
2. Check connection settings in `config/mods-available/sql`
3. Test connection: `docker exec freeradius psql -h radius-postgres -U radius -d radius`

### Redis connection errors

1. Verify Redis is running: `docker-compose ps radius-redis`
2. Test connection: `docker exec freeradius redis-cli -h radius-redis ping`
3. Check pool settings in `config/mods-available/redis`

## Ports

- **1812/udp**: RADIUS Authentication
- **1813/udp**: RADIUS Accounting
- **18120/tcp**: RADIUS Status Server
- **5433/tcp**: PostgreSQL (external access)
- **6380/tcp**: Redis (external access)

## License

FreeRADIUS is licensed under GPL v2. See FreeRADIUS documentation for details.

## Support

For FreeRADIUS support:
- Documentation: https://freeradius.org/documentation/
- Mailing list: https://freeradius.org/support/
- IRC: #freeradius on Libera.Chat

For this deployment configuration:
- Check logs in `logs/` directory
- Review configuration files in `config/` directory
- Consult PostgreSQL schema in `sql/schema.sql`
