# EdgeRuntime

**Enterprise ISP Edge Deployment** — Unified runtime combining CDC data synchronization, RADIUS authentication/accounting, and high-performance analytics.

## Architecture

```
┌──────────────────────────── EdgeRuntime ─────────────────────────────┐
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐  │
│  │ Cloud Kafka  │───►│ Kafka Connect│───►│  PostgreSQL             │  │
│  │ (CDC source) │    │ (JDBC Sink)  │    │  • RadiusUsers (synced) │  │
│  └─────────────┘    └──────────────┘    │  • radacct (accounting) │  │
│                                          │  • radpostauth          │  │
│  ┌─────────────┐                        │  • RadiusCustomAttrs    │  │
│  │  FreeRADIUS  │◄──────────────────────│                         │  │
│  │  Auth + Acct │───────────────────────►│                         │  │
│  └──────┬──────┘                        └─────────────────────────┘  │
│         │                                                            │
│  ┌──────┴──────┐    ┌──────────────┐    ┌─────────────────────────┐  │
│  │    Redis     │    │  Fluent Bit  │───►│   ClickHouse            │  │
│  │  • Sessions  │    │  (tail JSON  │    │   • Accounting analytics│  │
│  │  • Auth cache│    │   → HTTP)    │    │   • Traffic reports     │  │
│  │  • Rate limit│    └──────▲───────┘    │   • Session history     │  │
│  └─────────────┘           │             └─────────────────────────┘  │
│                     ┌──────┴───────┐                                  │
│                     │  JSON Linelog │                                  │
│                     │  (shared vol) │                                  │
│                     └──────────────┘                                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Purpose | Port(s) |
|---------|---------|---------|
| **PostgreSQL 18** | Edge database (CDC-synced users + RADIUS accounting) | 5434 |
| **Redis 7** | Session cache, auth cache, rate limiting | 6380 |
| **Kafka Connect** | CDC JDBC Sink (cloud → local sync) | 8084 |
| **ClickHouse 24** | Columnar analytics for accounting data | 8123, 9000 |
| **Fluent Bit 3.2** | Tails JSON linelog → ClickHouse HTTP insert | 2020 (metrics) |
| **FreeRADIUS 3.2** | RADIUS auth (1812/udp) + accounting (1813/udp) | 1812, 1813, 18120 |

## Quick Start

### 1. Configure

```bash
cp .env.example .env
# Edit .env with your actual values:
#   - POSTGRES_PASSWORD (change from default!)
#   - KAFKA_BOOTSTRAP_SERVERS (your cloud Kafka endpoint)
#   - CLICKHOUSE_PASSWORD
#   - NAS_SECRET
```

### 2. Start

```bash
docker compose up -d
```

### 3. Register CDC Connector

```bash
chmod +x scripts/*.sh
./scripts/register-connector.sh
```

### 4. Verify

```bash
./scripts/health-check.sh
```

### 5. Test RADIUS

```bash
# Test authentication (requires freeradius-utils)
./scripts/test-auth.sh

# Test full accounting pipeline (PostgreSQL → ClickHouse)
./scripts/test-accounting.sh
```

## Directory Structure

```
EdgeRuntime/
├── docker-compose.yml          # Unified compose for all services
├── Dockerfile                  # Kafka Connect + JDBC Sink plugin
├── .env.example                # Environment template
├── jdbc-sink-connector.json    # CDC sink connector config
├── config/
│   ├── clickhouse/
│   │   ├── config.xml          # ClickHouse server tuning
│   │   └── users.xml           # ClickHouse profiles & quotas
│   ├── fluent-bit/
│   │   ├── fluent-bit.conf     # Main pipeline config (tail → HTTP)
│   │   ├── parsers.conf        # JSON parser for linelog output
│   │   └── sanitize.lua        # Lua filter: numeric defaults, gigawords
│   └── freeradius/
│       ├── radiusd.conf        # Main RADIUS server config
│       ├── clients.conf        # NAS device definitions
│       ├── dictionary          # Custom VSA attributes
│       ├── mods-available/
│       │   ├── sql             # PostgreSQL module (auth + acct)
│       │   ├── redis           # Redis caching module
│       │   └── linelog_accounting  # JSON linelog for Fluent Bit
│       ├── mods-enabled/
│       │   ├── sql
│       │   ├── redis
│       │   └── linelog_accounting
│       ├── sites-available/
│       │   └── default         # Virtual server (SQL + linelog + Redis)
│       └── sites-enabled/
│           └── default
├── init/
│   ├── postgres/
│   │   └── 01-init.sql         # Schema: RadiusUsers, radacct, etc.
│   └── clickhouse/
│       └── 01-schema.sql       # Schema: radius_accounting + MVs
└── scripts/
    ├── register-connector.sh   # Register CDC sink connector
    ├── health-check.sh         # Check all services
    ├── test-auth.sh            # Test RADIUS authentication
    └── test-accounting.sh      # Test full accounting pipeline
```

## Data Flow

### Authentication (Read Path)
1. NAS device sends Access-Request to FreeRADIUS (UDP 1812)
2. FreeRADIUS queries local PostgreSQL for user credentials (`RadiusUsers`)
3. User data is kept in sync via CDC (Cloud → Kafka → Kafka Connect → PostgreSQL)
4. Auth results cached in Redis for performance

### Accounting (Write Path)
1. NAS sends Accounting packets to FreeRADIUS (UDP 1813)
2. FreeRADIUS writes to PostgreSQL `radacct` table (operational data)
3. FreeRADIUS also writes JSON via `linelog_accounting` to shared volume
4. Fluent Bit tails the JSON file with persistent offset tracking (at-least-once)
5. Fluent Bit sanitizes numeric fields via Lua filter (gigaword computation)
6. Fluent Bit batch-inserts into ClickHouse via HTTP (`INSERT ... FORMAT JSONEachRow`)

### CDC Sync (Cloud → Edge)
1. Cloud Debezium source captures changes from cloud PostgreSQL
2. Changes published to Kafka topics (e.g., `workspace_1.public.RadiusUsers`)
3. Local Kafka Connect JDBC Sink consumes and upserts into local PostgreSQL
4. FreeRADIUS reads from local PostgreSQL (no cloud dependency for auth)

## ClickHouse Analytics

Pre-built materialized views:
- **Hourly traffic per user** (`mv_hourly_traffic`)
- **Daily NAS summary** (`mv_daily_nas_summary`)
- **Daily auth summary** (`mv_daily_auth_summary`)

Example queries:

```sql
-- Active sessions
SELECT * FROM v_active_sessions;

-- Top users by traffic (24h)
SELECT * FROM v_top_users_24h;

-- Hourly traffic report
SELECT
    event_hour,
    username,
    sumMerge(total_input) AS download_bytes,
    sumMerge(total_output) AS upload_bytes
FROM mv_hourly_traffic
WHERE event_hour > now() - INTERVAL 24 HOUR
GROUP BY event_hour, username
ORDER BY download_bytes DESC;
```

## Production Checklist

- [ ] Change all default passwords in `.env`
- [ ] Configure NAS secrets in `clients.conf` (or via `RadiusNasDevices` table)
- [ ] Set `RADIUS_CMD=-f` (foreground, not debug) for production
- [ ] Configure SSL/TLS for PostgreSQL and Kafka connections
- [ ] Set up backup strategy for PostgreSQL and ClickHouse volumes
- [ ] Configure ClickHouse TTL retention policy (default: 2 years)
- [ ] Set appropriate resource limits in docker-compose for your hardware
- [ ] Set up monitoring/alerting for the health check script
- [ ] Review ClickHouse `config.xml` memory settings for your server
