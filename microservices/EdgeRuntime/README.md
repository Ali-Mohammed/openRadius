# EdgeRuntime — Enterprise ISP Edge Deployment

Unified edge deployment for **FreeRADIUS**, **PostgreSQL**, **Redis**, **ClickHouse**, **Kafka Connect (CDC)**, and **Fluent Bit**.
Designed for ISP environments that need high-performance RADIUS authentication, accounting, and real-time analytics at the network edge.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              EdgeRuntime (Docker Compose)                            │
│                                                                                     │
│   ┌──────────────┐    CDC Topics (4)     ┌────────────────┐     JDBC Sink           │
│   │  Cloud Kafka  │ ──────────────────► │  Kafka Connect  │ ──────────────►┐       │
│   │  (Debezium    │  • RadiusUsers       │  (Debezium 3.0  │   upsert       │       │
│   │   Source)     │  • RadiusNasDevices   │   JDBC Sink)    │   auto.create  │       │
│   └──────────────┘  • RadiusProfiles     └────────────────┘   auto.evolve  │       │
│                      • RadiusCustomAttr                                     │       │
│                                                                             ▼       │
│   ┌──────────────┐                     ┌─────────────────────────────────────────┐  │
│   │    Redis      │ ◄───────────────► │              PostgreSQL 18.1             │  │
│   │  redis:7      │   auth cache       │                                         │  │
│   │  4 databases  │   session mgmt     │  CDC Tables:                            │  │
│   │  DB0: general │   rate limiting    │    • RadiusUsers (auth credentials)     │  │
│   │  DB1: sessions│                     │    • RadiusNasDevices (NAS/BNG clients) │  │
│   │  DB2: auth    │                     │    • RadiusProfiles                     │  │
│   │  DB3: rate    │                     │    • RadiusCustomAttributes (reply AVPs)│  │
│   └──────┬───────┘                     │  FreeRADIUS Tables:                     │  │
│          │                              │    • radacct (accounting sessions)      │  │
│          │       ┌──────────────────┐   │    • radpostauth (auth log)             │  │
│          └──────►│   FreeRADIUS 3.2  │◄─┤    • radcheck/radreply (overrides)     │  │
│                  │                    │  └─────────────────────────────────────────┘  │
│                  │  Auth:  SQL module │                                               │
│                  │         RadiusUsers│                                               │
│                  │  NAS:   SQL client │                                               │
│                  │         RadiusNas  │                                               │
│                  │  Acct:  SQL +      │                                               │
│                  │         linelog    │                                               │
│                  └────────┬──────────┘                                               │
│                           │ JSON linelog                                              │
│                           │ (accounting.json + postauth.json)                        │
│                           ▼                                                          │
│                  ┌──────────────────┐          ┌───────────────────────┐             │
│                  │   Fluent Bit 3.2  │ ──────► │   ClickHouse 24.8     │             │
│                  │   tail → lua →    │  HTTP    │   radius_analytics DB │             │
│                  │   HTTP output     │  INSERT  │   MergeTree + MVs     │             │
│                  └──────────────────┘          │   2yr TTL             │             │
│                                                └───────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Services

| Service            | Image                                        | Port(s)                              | Purpose                                                        |
|--------------------|----------------------------------------------|--------------------------------------|----------------------------------------------------------------|
| **PostgreSQL**     | `postgres:18.1`                              | `5434` → 5432                        | Edge DB — CDC-synced tables + FreeRADIUS radacct/postauth       |
| **Redis**          | `redis:7-alpine`                             | `6380` → 6379                        | Auth cache (DB2), sessions (DB1), general (DB0), rate limit (DB3) |
| **Kafka Connect**  | `debezium/connect:3.0.0.Final` + JDBC        | `8084` → 8083                        | JDBC Sink — cloud CDC → local PostgreSQL (4 tables)             |
| **ClickHouse**     | `clickhouse/clickhouse-server:24.8-alpine`   | `8123` (HTTP), `9000` (native)       | Columnar analytics — accounting + auth event storage            |
| **Fluent Bit**     | `fluent/fluent-bit:3.2`                      | `2020` (metrics)                     | JSON linelog → ClickHouse HTTP pipeline (acct + postauth)       |
| **FreeRADIUS**     | `freeradius/freeradius-server:latest`         | `1812/udp`, `1813/udp`, `18120`      | RADIUS authentication + accounting server                       |

---

## Quick Start

```bash
# 1. Clone and configure
cd microservices/EdgeRuntime
cp .env.example .env
# Edit .env — set passwords, Kafka server, site ID, etc.

# 2. Start all services
docker compose up -d

# 3. Wait for services to be healthy (~60s), then register the CDC connector
./scripts/register-connector.sh

# 4. Verify all services
./scripts/health-check.sh

# 5. Test authentication
./scripts/test-auth.sh

# 6. Test accounting pipeline (PostgreSQL + ClickHouse)
./scripts/test-accounting.sh
```

---

## Directory Structure

```
EdgeRuntime/
├── .env.example                                 # Environment variable template
├── .gitignore                                   # Git ignore rules
├── docker-compose.yml                           # Unified 6-service Docker Compose
├── Dockerfile                                   # Kafka Connect + JDBC Sink plugin
├── jdbc-sink-connector.json                     # CDC connector configuration (4 topics)
├── README.md                                    # This file
│
├── config/
│   ├── clickhouse/
│   │   ├── config.xml                           # Server tuning (connections, memory, merge tree)
│   │   └── users.xml                            # Profiles & quotas (default, readonly, batch_writer)
│   │
│   ├── fluent-bit/
│   │   ├── fluent-bit.conf                      # Full pipeline: tail → modify → lua → HTTP output
│   │   ├── parsers.conf                         # JSON parser definition
│   │   └── sanitize.lua                         # Numeric defaults, gigaword computation, field cleanup
│   │
│   └── freeradius/
│       ├── radiusd.conf                         # Server config: threads (5-32), max_requests (16384)
│       ├── clients.conf                         # Static clients: localhost, docker-network (172.16.0.0/12)
│       ├── dictionary                           # Custom VSA vendor 99999 (bandwidth, QoS, billing)
│       │
│       ├── mods-available/
│       │   ├── sql                              # SQL module: connection pool, read_clients, $INCLUDE queries
│       │   ├── redis                            # 4 Redis instances (DB0-3: general, sessions, auth, rate)
│       │   └── linelog_accounting               # JSON linelog for accounting + postauth events
│       ├── mods-enabled/
│       │   ├── sql                              # → symlink to mods-available/sql
│       │   ├── redis                            # → symlink to mods-available/redis
│       │   └── linelog_accounting               # → symlink to mods-available/linelog_accounting
│       │
│       ├── mods-config/
│       │   └── sql/
│       │       └── main/
│       │           └── postgresql/
│       │               └── queries.conf         # ★ Custom PostgreSQL queries:
│       │                                        #   client_query → RadiusNasDevices
│       │                                        #   authorize_check_query → RadiusUsers
│       │                                        #   authorize_reply_query → RadiusCustomAttributes
│       │                                        #   Accounting & post-auth → radacct / radpostauth
│       │
│       ├── sites-available/
│       │   └── default                          # Virtual server: auth + acct + post-auth pipelines
│       └── sites-enabled/
│           └── default                          # → symlink to sites-available/default
│
├── connectors/
│   └── debezium-connector-jdbc/                 # Pre-installed JDBC Sink connector plugin files
│
├── init/
│   ├── clickhouse/
│   │   └── 01-schema.sql                        # radius_analytics DB: tables, MVs, views
│   └── postgres/
│       └── 01-init.sql                          # RadiusUsers schema + radacct + radpostauth + check/reply
│
└── scripts/
    ├── health-check.sh                          # Service health + connector status + table row counts
    ├── register-connector.sh                    # Register/recreate JDBC Sink connector interactively
    ├── test-auth.sh                             # Test RADIUS auth (auto-discovers CDC-synced users)
    └── test-accounting.sh                       # Full pipeline test: Start → Interim → Stop → verify
```

---

## Data Flow

### 1. CDC Sync (Cloud → Edge)

```
Cloud Kafka (Debezium Source) ──► Kafka Connect (JDBC Sink) ──► PostgreSQL (edge_db)
```

**4 CDC topics synced** via Debezium JDBC Sink Connector (`jdbc-sink-connector.json`):

| Topic                                       | Edge Table               | Purpose                                 |
|---------------------------------------------|--------------------------|---------------------------------------- |
| `workspace_1.public.RadiusUsers`            | `RadiusUsers`            | Subscriber credentials & expiration     |
| `workspace_1.public.RadiusNasDevices`       | `RadiusNasDevices`       | NAS/BNG devices (IP, secret, type)      |
| `workspace_1.public.RadiusProfiles`         | `RadiusProfiles`         | Service/billing profiles                |
| `workspace_1.public.RadiusCustomAttributes` | `RadiusCustomAttributes` | Per-profile & per-user RADIUS AVPs      |

**Connector features:**

- `RegexRouter` transform strips `workspace_1.public.` prefix → tables match cloud schema
- **Upsert mode** with `primary.key.fields = Id` — handles inserts + updates
- `delete.enabled = true` — CDC deletes propagate to edge
- `auto.create = true` + `auto.evolve = true` — zero-downtime schema changes
- `errors.tolerance = all` with dead-letter queue (`dlq-jdbc-sink-workspace_1`)

### 2. Authentication (FreeRADIUS ← PostgreSQL)

```
RADIUS Client ──► FreeRADIUS ──► SQL Module ──► PostgreSQL (RadiusUsers)
```

**Authentication flow:**

1. RADIUS Access-Request arrives at FreeRADIUS (UDP 1812)
2. `authorize` section queries `RadiusUsers` via `authorize_check_query`
3. Checks: enabled, not deleted, has password, not expired
4. Reply attributes from `RadiusCustomAttributes` via `authorize_reply_query`:
   - **Profile-level**: joins `RadiusCustomAttributes.RadiusProfileId` → `RadiusUsers.ProfileId`
   - **User-level**: matches `RadiusCustomAttributes.RadiusUserId` → `RadiusUsers.Id`
5. PAP/CHAP/MS-CHAP authentication in `authenticate` section
6. Post-auth logs to both PostgreSQL (`radpostauth`) and JSON linelog → ClickHouse

**`authorize_check_query`** (from `queries.conf`):

```sql
SELECT 'Cleartext-Password' AS attribute, "Password" AS value, ':=' AS op
FROM "RadiusUsers"
WHERE "Username" = '%{SQL-User-Name}'
  AND "Enabled" = true
  AND "IsDeleted" = false
  AND "Password" IS NOT NULL
  AND ("Expiration" IS NULL OR "Expiration" > NOW())
```

### 3. NAS Client Loading (FreeRADIUS ← PostgreSQL)

```
FreeRADIUS (startup + reload) ──► SQL read_clients ──► "RadiusNasDevices" table
```

**Dynamic NAS loading** via `client_query` in `queries.conf`:

- Reads from `"RadiusNasDevices"` where `"Enabled" = 1` AND `"IsDeleted" = false`
- Column mapping: `"Nasname"` → nasname, `"Shortname"` → shortname, `"Secret"` → secret, `"Server"` → server
- **Type mapping** (integer → FreeRADIUS string):

  | Type value | FreeRADIUS type |
  |------------|-----------------|
  | `0`        | `other`         |
  | `1`        | `cisco`         |
  | `2`        | `mikrotik`      |

- **Static fallback clients** in `clients.conf`:
  - `localhost` (127.0.0.1) — secret: `testing123` — for health checks & testing
  - `docker-network` (172.16.0.0/12) — secret: `testing123` — for inter-container communication

### 4. Accounting (Dual-Write Pipeline)

```
RADIUS Accounting Packet (Start / Interim-Update / Stop)
    │
    ├──► SQL module ──► PostgreSQL (radacct)
    │    • Session lifecycle: Start creates, Interim updates, Stop finalizes
    │    • Consolidated: 1 row per session (upsert by acctuniqueid)
    │    • Used for: operational queries, concurrent session checks
    │
    └──► linelog_accounting ──► /var/log/radius/accounting.json
                                        │
                                        ▼
                                 Fluent Bit (tail)
                                        │ modify filter (add edge_site_id)
                                        │ lua filter (sanitize numerics, compute gigawords)
                                        ▼
                                 ClickHouse (HTTP INSERT → radius_accounting)
                                        • Event-sourced: every event is a separate row
                                        • Partitioned by month (toYYYYMM)
                                        • Ordered by (username, event_timestamp, acctsessionid)
                                        • 2-year TTL auto-deletion
                                        • Feeds materialized views for real-time analytics
```

**Fluent Bit processing pipeline:**

1. **Tail input** — reads JSON lines from `/var/log/radius/accounting.json` (+ `postauth.json`)
2. **Modify filter** — adds `edge_site_id` metadata from `$EDGE_SITE_ID`
3. **Lua filter** (`sanitize.lua`) — ensures numeric type safety for ClickHouse:
   - Defaults all numeric fields to `0` if nil/empty
   - Computes gigaword-adjusted octets: `total = (gigawords × 2³²) + octets`
   - Removes `acctinputgigawords` / `acctoutputgigawords` (not in ClickHouse schema)
4. **HTTP output** — batch inserts to ClickHouse via `JSONEachRow` format

### 5. Post-Auth Logging

```
Auth Result (Accept / Reject) ──► SQL (radpostauth) + linelog (postauth.json)
                                                               │
                                                               ▼
                                                        Fluent Bit → ClickHouse (radius_postauth)
```

Both **accept** and **reject** events are logged for security auditing and authentication analytics.

---

## ClickHouse Analytics

### Database: `radius_analytics`

| Object                  | Engine                | Description                                               | TTL     |
|-------------------------|-----------------------|-----------------------------------------------------------|---------|
| `radius_accounting`     | MergeTree             | All accounting events (Start / Interim / Stop / On / Off) | 2 years |
| `radius_postauth`       | MergeTree             | Auth events (accept/reject) with username + reply         | 1 year  |
| `mv_hourly_traffic`     | AggregatingMergeTree  | Hourly traffic aggregates per user + NAS (auto-populated) | —       |
| `mv_daily_nas_summary`  | AggregatingMergeTree  | Daily summary per NAS (unique users, sessions, traffic)   | —       |
| `mv_daily_auth_summary` | AggregatingMergeTree  | Daily auth counts by reply type                           | —       |
| `v_active_sessions`     | View                  | Currently active sessions (start with no stop, 24h)       | —       |
| `v_top_users_24h`       | View                  | Top 100 users by traffic in last 24 hours                 | —       |

### Accessing ClickHouse

```bash
# CLI inside container
docker exec -it edge_clickhouse clickhouse-client --database radius_analytics

# HTTP API from host
curl 'http://localhost:8123/?database=radius_analytics' --data-binary 'SELECT count() FROM radius_accounting'
```

### Example Queries

```sql
-- Active sessions (started in last 24h with no stop event)
SELECT * FROM radius_analytics.v_active_sessions;

-- Top users by traffic (last 24h)
SELECT * FROM radius_analytics.v_top_users_24h;

-- Hourly traffic report
SELECT
    event_hour,
    username,
    sumMerge(total_input)  AS download_bytes,
    sumMerge(total_output) AS upload_bytes,
    countMerge(session_count) AS sessions
FROM radius_analytics.mv_hourly_traffic
WHERE event_hour >= now() - INTERVAL 24 HOUR
GROUP BY event_hour, username
ORDER BY download_bytes DESC;

-- Daily NAS utilization
SELECT
    event_date,
    nasipaddress,
    uniqMerge(unique_users)    AS users,
    countMerge(total_sessions) AS sessions,
    sumMerge(total_input) + sumMerge(total_output) AS total_bytes
FROM radius_analytics.mv_daily_nas_summary
GROUP BY event_date, nasipaddress
ORDER BY event_date DESC;

-- Auth success vs reject rate
SELECT
    event_date,
    reply,
    countMerge(auth_count)    AS total,
    uniqMerge(unique_users)   AS unique_users
FROM radius_analytics.mv_daily_auth_summary
GROUP BY event_date, reply
ORDER BY event_date DESC;

-- Raw accounting events for a specific session
SELECT
    acctsessionid,
    username,
    event_type,
    toDateTime(event_timestamp) AS event_time,
    acctsessiontime,
    acctinputoctets,
    acctoutputoctets,
    acctterminatecause
FROM radius_analytics.radius_accounting
WHERE acctsessionid = 'your-session-id'
ORDER BY event_timestamp;
```

---

## PostgreSQL Schema

### CDC-Synced Tables (auto-created by JDBC Sink)

| Table                    | Key Columns                                                              | Purpose                   |
|--------------------------|--------------------------------------------------------------------------|---------------------------|
| `RadiusUsers`            | Id, Uuid, Username, Password, Enabled, IsDeleted, Expiration, ProfileId  | Subscriber authentication |
| `RadiusNasDevices`       | Id, Nasname, Shortname, Type, Secret, Enabled, IsDeleted                 | NAS/BNG client loading    |
| `RadiusProfiles`         | Id, name, billing details                                                | Service profiles          |
| `RadiusCustomAttributes` | Id, AttributeName, AttributeValue, RadiusProfileId, RadiusUserId         | RADIUS reply attributes   |

### FreeRADIUS Operational Tables (created by `init/postgres/01-init.sql`)

| Table            | Purpose                                         |
|------------------|------------------------------------------------ |
| `radacct`        | Accounting sessions (1 row per session, upsert) |
| `radpostauth`    | Post-auth log (every auth attempt)              |
| `radcheck`       | Per-user check items (optional overrides)       |
| `radreply`       | Per-user reply items (optional overrides)       |
| `radgroupcheck`  | Per-group check items                           |
| `radgroupreply`  | Per-group reply items                           |
| `radusergroup`   | User-to-group mappings                          |

---

## Environment Variables

Full reference in `.env.example`:

| Variable                   | Default                  | Description                                      |
|----------------------------|--------------------------|--------------------------------------------------|
| `COMPOSE_PROJECT_NAME`     | `edge`                   | Docker project name (container prefix)           |
| `POSTGRES_DB`              | `edge_db`                | PostgreSQL database name                         |
| `POSTGRES_USER`            | `postgres`               | PostgreSQL user                                  |
| `POSTGRES_PASSWORD`        | `changeme_in_production` | PostgreSQL password (**change in production**)   |
| `POSTGRES_PORT`            | `5434`                   | Host port for PostgreSQL                         |
| `REDIS_MAX_MEMORY`         | `512mb`                  | Redis max memory (LRU eviction)                  |
| `REDIS_PORT`               | `6380`                   | Host port for Redis                              |
| `KAFKA_BOOTSTRAP_SERVERS`  | `157.230.113.249:9094`   | Cloud Kafka broker address                       |
| `KAFKA_HOST_IP`            | `157.230.113.249`        | Kafka host IP (for extra_hosts DNS)              |
| `CONNECTOR_GROUP_ID`       | `2`                      | Kafka Connect consumer group ID                  |
| `CONNECT_PORT`             | `8084`                   | Kafka Connect REST API host port                 |
| `CLICKHOUSE_DB`            | `radius_analytics`       | ClickHouse database name                         |
| `CLICKHOUSE_USER`          | `radius`                 | ClickHouse user                                  |
| `CLICKHOUSE_PASSWORD`      | `changeme_in_production` | ClickHouse password (**change in production**)   |
| `CLICKHOUSE_HTTP_PORT`     | `8123`                   | ClickHouse HTTP interface host port              |
| `CLICKHOUSE_NATIVE_PORT`   | `9000`                   | ClickHouse native protocol host port             |
| `EDGE_SITE_ID`             | `edge-1`                 | Site identifier (tagged on all accounting events)|
| `FLUENT_BIT_METRICS_PORT`  | `2020`                   | Fluent Bit metrics endpoint host port            |
| `LOG_LEVEL`                | `info`                   | Fluent Bit log level                             |
| `RADIUS_AUTH_PORT`         | `1812`                   | RADIUS authentication host port (UDP)            |
| `RADIUS_ACCT_PORT`         | `1813`                   | RADIUS accounting host port (UDP)                |
| `RADIUS_STATUS_PORT`       | `18120`                  | FreeRADIUS status port                           |
| `RADIUS_STATUS_SECRET`     | `adminsecret`            | FreeRADIUS status secret                         |
| `RADIUS_CMD`               | `-X`                     | FreeRADIUS flag (`-X` debug, `-f` foreground)    |
| `NAS_SECRET`               | `testing123`             | Default NAS shared secret                        |
| `TZ`                       | `UTC`                    | Timezone for FreeRADIUS                          |

---

## Docker Volumes

| Volume           | Service                   | Mount Point                  | Purpose                                  |
|------------------|---------------------------|------------------------------|------------------------------------------|
| `postgres_data`  | PostgreSQL                | `/var/lib/postgresql`        | Database files                           |
| `redis_data`     | Redis                     | `/data`                      | AOF persistence + RDB snapshots          |
| `clickhouse_data`| ClickHouse                | `/var/lib/clickhouse`        | Columnar data storage                    |
| `clickhouse_logs`| ClickHouse                | `/var/log/clickhouse-server` | Server logs                              |
| `radius_logs`    | FreeRADIUS + Fluent Bit   | `/var/log/radius`            | Shared: FreeRADIUS writes, Fluent Bit reads |
| `fluent_bit_data`| Fluent Bit                | `/fluent-bit/data`           | Persistent tail DB + buffer storage      |

---

## FreeRADIUS Configuration

### SQL Module (`config/freeradius/mods-available/sql`)

- **Driver**: `rlm_sql_postgresql`
- **Connection**: `postgres:5432/edge_db` (Docker internal network)
- **Pool**: start=5, min=3, max=32, spare=10, idle_timeout=60s
- **`read_clients = yes`** — loads NAS devices from `RadiusNasDevices` at startup
- All queries defined in `$INCLUDE ${modconfdir}/sql/main/${dialect}/queries.conf`

### Custom Queries (`config/freeradius/mods-config/sql/main/postgresql/queries.conf`)

| Query                   | Source Table               | Logic                                                              |
|-------------------------|----------------------------|--------------------------------------------------------------------|
| `client_query`          | `RadiusNasDevices`         | Load NAS: Enabled=1, IsDeleted=false, CASE Type → string          |
| `authorize_check_query` | `RadiusUsers`              | Cleartext-Password: Enabled, !Deleted, has password, not expired   |
| `authorize_reply_query` | `RadiusCustomAttributes`   | UNION: profile-level (via ProfileId) + user-level (via RadiusUserId) |
| `accounting.*`          | `radacct`                  | Standard FreeRADIUS accounting (start/interim/stop/on/off)         |
| `post-auth`             | `radpostauth`              | Auth event logging (accept + reject)                               |
| `simul_count_query`     | `radacct`                  | Concurrent session counting                                        |

### Linelog Module (`config/freeradius/mods-available/linelog_accounting`)

- **`accounting_json`**: writes to `/var/log/radius/accounting.json` — one JSON object per accounting event
- **`postauth_json`**: writes to `/var/log/radius/postauth.json` — one JSON object per auth result
- Event types: `start`, `interim-update`, `stop`, `accounting-on`, `accounting-off`

### Virtual Server (`config/freeradius/sites-available/default`)

- **authorize**: preprocess → SQL (RadiusUsers) → PAP/CHAP
- **authenticate**: PAP, CHAP, MS-CHAP
- **accounting**: SQL (radacct) + `accounting_json` (linelog) + detail
- **post-auth**: SQL (radpostauth) + `postauth_json` (linelog) + default timeouts (Session=86400s, Idle=3600s)

### Custom Dictionary (`config/freeradius/dictionary`)

- Vendor: **Custom** (ID: 99999)
- Attributes: bandwidth (download/upload speed), subscriber management, location, QoS, billing, session control
- Values: Account-Status (Active/Suspended/Expired/Terminated), Priority-Level (Low/Medium/High/Critical)

---

## Scripts

| Script                         | Description                                                               |
|--------------------------------|---------------------------------------------------------------------------|
| `scripts/health-check.sh`     | Checks all 6 containers, connector status, PG/CH table counts, Redis     |
| `scripts/register-connector.sh`| Registers JDBC Sink connector (interactive — prompts to recreate if exists)|
| `scripts/test-auth.sh`        | Auto-discovers a CDC-synced user, runs `radtest`, tests reject case       |
| `scripts/test-accounting.sh`  | Sends Start → Interim → Stop, verifies data in both PostgreSQL and ClickHouse |

---

## Kafka Connect (Debezium JDBC Sink)

### Dockerfile

Built on `debezium/connect:3.0.0.Final` with the Debezium JDBC Sink Connector plugin (`3.0.0.Final`) installed at build time.

### Connector Configuration (`jdbc-sink-connector.json`)

- **Name**: `jdbc-sink-workspace_1`
- **Connection**: `jdbc:postgresql://postgres:5432/edge_db`
- **Topics**: 4 CDC topics (RadiusUsers, RadiusNasDevices, RadiusProfiles, RadiusCustomAttributes)
- **Transform**: `RegexRouter` — strips `workspace_1.public.` prefix
- **Mode**: upsert, primary key = `Id`
- **Error handling**: `errors.tolerance = all`, dead-letter queue enabled
- **Converters**: `JsonConverter` with schemas enabled

### Useful REST API Endpoints

```bash
# List connectors
curl http://localhost:8084/connectors

# Connector status
curl http://localhost:8084/connectors/jdbc-sink-workspace_1/status

# Restart a failed task
curl -X POST http://localhost:8084/connectors/jdbc-sink-workspace_1/tasks/0/restart

# Delete connector
curl -X DELETE http://localhost:8084/connectors/jdbc-sink-workspace_1
```

---

## Resource Limits

| Service        | CPU Limit | Memory Limit | CPU Reserved | Memory Reserved |
|----------------|-----------|--------------|--------------|-----------------|
| PostgreSQL     | 2 cores   | 2 GB         | 0.5 cores    | 512 MB          |
| Redis          | 1 core    | 1 GB         | 0.25 cores   | 128 MB          |
| Kafka Connect  | 2 cores   | 3 GB         | 0.5 cores    | 1 GB            |
| ClickHouse     | 2 cores   | 4 GB         | 0.5 cores    | 512 MB          |
| Fluent Bit     | 1 core    | 256 MB       | 0.25 cores   | 64 MB           |
| FreeRADIUS     | 2 cores   | 1 GB         | 0.5 cores    | 256 MB          |
| **Total**      | **10 cores** | **11.25 GB** | **2.5 cores** | **2.46 GB**  |

---

## Production Checklist

### Security

- [ ] Change all default passwords in `.env` (`POSTGRES_PASSWORD`, `CLICKHOUSE_PASSWORD`, `NAS_SECRET`, `RADIUS_STATUS_SECRET`)
- [ ] Configure TLS for Kafka Connect if using public Kafka
- [ ] Review and restrict `clients.conf` IP ranges to your actual NAS subnets
- [ ] Update ClickHouse passwords and use the `readonly` profile for dashboards

### Performance

- [ ] Set `RADIUS_CMD=-f` (foreground, no debug logging) instead of `-X`
- [ ] Remove/disable the `stdout` output in `fluent-bit.conf`
- [ ] Tune PostgreSQL `shared_buffers`, `work_mem`, `effective_cache_size` for your hardware
- [ ] Adjust resource limits in `docker-compose.yml` for your server specs

### Operations

- [ ] Set `COMPOSE_PROJECT_NAME` to a unique identifier per edge site
- [ ] Set `EDGE_SITE_ID` to match your site naming convention
- [ ] Set up log rotation for FreeRADIUS detail files
- [ ] Configure backup strategy for PostgreSQL and ClickHouse data volumes
- [ ] Monitor disk usage for ClickHouse data volume (2-year accounting TTL, 1-year auth TTL)
- [ ] Set up monitoring/alerting on `scripts/health-check.sh` output
- [ ] Configure Fluent Bit `storage.max_chunks_up` based on expected accounting volume
