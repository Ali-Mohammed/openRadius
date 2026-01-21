# Debezium JDBC Sink Connector Setup - Issue Resolution Summary

## Project Overview
Setup a Debezium JDBC Sink Connector to consume CDC (Change Data Capture) events from Redpanda and write them to a PostgreSQL database.

**Architecture:**
```
Source Database (with Debezium Source Connector)
    ↓
Redpanda Topic: workspace_1.public.RadiusUsers
    ↓
Debezium JDBC Sink Connector (connect_local1)
    ↓
PostgreSQL Database: local1_db
    → Table: RadiusUsers
```

---

## Issues Encountered and Solutions

### Issue 1: Incorrect Redpanda Port
**Problem:**
- Initially configured with `BOOTSTRAP_SERVERS: redpanda:9092`
- Kafka Connect couldn't establish connection
- Logs showed: `Connection to node 0 (localhost/127.0.0.1:9092) could not be established`

**Root Cause:**
Redpanda has two listeners:
- **Internal listener:** `redpanda:19092` (for Docker network communication)
- **External listener:** `localhost:9092` (for host machine access)

When connecting via `redpanda:9092`, Redpanda's advertised listener redirected clients to `localhost:9092`, which doesn't exist inside the container.

**Solution:**
```yaml
BOOTSTRAP_SERVERS: redpanda:19092  # Use internal listener port
```

---

### Issue 2: Wrong Group ID
**Problem:**
- Environment variable set as `GROUP_ID: 2`
- Container was joining group ID 1 instead
- This caused it to cluster with another Kafka Connect instance (connect_cloud)

**Root Cause:**
The Debezium Connect Docker image uses `CONNECT_GROUP_ID` as the environment variable name, not `GROUP_ID`. However, when using a custom `command` override, we needed to export `GROUP_ID` before calling the entrypoint script.

**Solution:**
```yaml
environment:
  CONNECT_GROUP_ID: 2  # Set environment variable
command:
  - bash
  - -c
  - |
    export GROUP_ID=2  # Export before entrypoint
    /docker-entrypoint.sh start &
```

---

### Issue 3: Missing JDBC Sink Connector Plugin
**Problem:**
- Connector registration failed with error: `Failed to find any class that implements Connector and which name matches io.debezium.connector.jdbc.JdbcSinkConnector`
- The Debezium Connect image doesn't include the JDBC Sink Connector by default

**Root Cause:**
The `debezium/connect` image only includes source connectors (MySQL, PostgreSQL, MongoDB, etc.). The JDBC Sink Connector must be installed separately.

**Solution:**
Download and install the plugin before starting Kafka Connect:
```bash
cd /kafka/connect
curl -L https://repo1.maven.org/maven2/io/debezium/debezium-connector-jdbc/3.0.0.Final/debezium-connector-jdbc-3.0.0.Final-plugin.tar.gz | tar xz
```

---

### Issue 4: Table Name Case Sensitivity
**Problem:**
- Connector couldn't find table: `Could not find table: public.RadiusUsers`
- PostgreSQL table name is `RadiusUsers` (mixed case with quoted identifiers)
- Initial config used `table.name.format: "public.RadiusUsers"` without proper quoting

**Root Cause:**
PostgreSQL treats unquoted identifiers as lowercase. The table was created as `"RadiusUsers"` (quoted, preserving case), but the connector was looking for `radiususers` (unquoted, converted to lowercase).

**Initial Attempt - Failed:**
```json
"table.name.format": "public.RadiusUsers"
// Looked for: radiususers (lowercase)
```

**Intermediate Attempt - Created New Table:**
```json
"table.name.format": "${topic}",
"auto.create": "true"
// Created: workspace_1_public_radiususers (new table)
```

**Final Solution:**
```json
"table.name.format": "public.RadiusUsers",
"quote.identifiers": "true",
"auto.create": "false",
"schema.evolution": "basic"
```

This configuration:
- Uses the exact table name `RadiusUsers`
- Enables identifier quoting to preserve case
- Disables auto-create to use existing table
- Enables schema evolution for automatic schema updates

---

### Issue 5: Data in Wrong Table
**Problem:**
- After fixing table naming, data (1000 rows) was in `workspace_1_public_radiususers`
- The `RadiusUsers` table was empty
- Consumer offset was already at 1001 (all messages consumed)

**Root Cause:**
During troubleshooting, we temporarily used `table.name.format: "${topic}"` which created a new table. The connector consumed all 1000 messages and committed offset 1001, so it wouldn't re-process them.

**Solution:**
1. Delete the connector
2. Delete the consumer group to reset offsets:
   ```bash
   docker exec redpanda rpk group delete connect-jdbc-sink-connector
   ```
3. Recreate connector with correct configuration
4. Connector started from offset 0 and processed all 1000 messages into `RadiusUsers` table

---

## Final Working Configuration

### Environment Variables
```yaml
environment:
  BOOTSTRAP_SERVERS: redpanda:19092
  CONNECT_GROUP_ID: 2
  CONFIG_STORAGE_TOPIC: connect_configs_local1
  OFFSET_STORAGE_TOPIC: connect_offsets_local1
  STATUS_STORAGE_TOPIC: connect_status_local1
  CONNECT_REST_ADVERTISED_HOST_NAME: connect_local1
  CONNECT_PLUGIN_PATH: /kafka/connect
```

### JDBC Sink Connector Configuration
```json
{
  "name": "jdbc-sink-connector",
  "config": {
    "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector",
    "tasks.max": "1",
    "topics": "workspace_1.public.RadiusUsers",
    "connection.url": "jdbc:postgresql://postgres_local1:5432/local1_db",
    "connection.username": "postgres",
    "connection.password": "postgres",
    "insert.mode": "upsert",
    "delete.enabled": "true",
    "primary.key.mode": "record_key",
    "primary.key.fields": "Id",
    "auto.create": "false",
    "auto.evolve": "true",
    "schema.evolution": "basic",
    "quote.identifiers": "true",
    "table.name.format": "public.RadiusUsers",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "true",
    "value.converter.schemas.enable": "true"
  }
}
```

### Key Configuration Parameters Explained

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `insert.mode` | `upsert` | Insert new records or update existing ones based on primary key |
| `delete.enabled` | `true` | Process delete events from CDC stream |
| `primary.key.mode` | `record_key` | Use the Kafka message key as the primary key |
| `primary.key.fields` | `Id` | The database column to use as primary key |
| `auto.create` | `false` | Don't create table automatically, use existing one |
| `auto.evolve` | `true` | Allow schema changes to be applied to existing table |
| `schema.evolution` | `basic` | Enable basic schema evolution support |
| `quote.identifiers` | `true` | Quote table/column names to preserve case sensitivity |
| `table.name.format` | `public.RadiusUsers` | Exact table name with schema |

---

## Verification

### Check Connector Status
```bash
curl -s http://localhost:8084/connectors/jdbc-sink-connector/status | jq
```

Expected output:
```json
{
  "name": "jdbc-sink-connector",
  "connector": {
    "state": "RUNNING",
    "worker_id": "172.21.0.7:8083"
  },
  "tasks": [
    {
      "id": 0,
      "state": "RUNNING",
      "worker_id": "172.21.0.7:8083"
    }
  ],
  "type": "sink"
}
```

### Check Data in PostgreSQL
```bash
docker exec postgres_local1 psql -U postgres -d local1_db -c 'SELECT COUNT(*) FROM "RadiusUsers";'
```

Expected: 1000 rows

### Sample Data
```sql
SELECT "Id", "Username", "Email", "Balance" 
FROM "RadiusUsers" 
LIMIT 5;
```

---

## Network Architecture

```
Docker Network: openradius_openradius-network
│
├── redpanda:19092 (internal listener)
│   └── Topic: workspace_1.public.RadiusUsers
│
├── connect_local1:8084 (REST API)
│   └── Group ID: 2
│
└── postgres_local1:5432
    └── Database: local1_db
        └── Table: RadiusUsers
```

---

## Troubleshooting Commands

### Check Kafka Connect Logs
```bash
docker logs connect_local1 --tail 50
```

### List All Connectors
```bash
curl -s http://localhost:8084/connectors
```

### View Connector Configuration
```bash
curl -s http://localhost:8084/connectors/jdbc-sink-connector | jq
```

### Check Consumer Group Offsets
```bash
docker exec redpanda rpk group describe connect-jdbc-sink-connector
```

### View Topic Messages
```bash
docker exec redpanda rpk topic consume workspace_1.public.RadiusUsers --num 5
```

### Check PostgreSQL Tables
```bash
docker exec postgres_local1 psql -U postgres -d local1_db -c "\dt"
```

---

## Key Learnings

1. **Redpanda Listeners**: Always use the internal listener port (19092) for Docker network communication
2. **Environment Variables**: Custom commands require explicit exports before calling entrypoint scripts
3. **Plugin Installation**: JDBC Sink Connector is not included by default in debezium/connect image
4. **PostgreSQL Case Sensitivity**: Quoted identifiers preserve case; always use `quote.identifiers: true` for mixed-case table names
5. **Consumer Offsets**: Changing connector configuration doesn't reset offsets; must delete consumer group manually
6. **Schema Evolution**: Use `schema.evolution: basic` for automatic schema updates while preventing unwanted table creation

---

## Production Recommendations

1. **Pre-install Plugins**: Build a custom Docker image with JDBC Sink Connector pre-installed instead of downloading at runtime
2. **Monitoring**: Set up monitoring for connector status and lag metrics
3. **Error Handling**: Configure `errors.tolerance` and `errors.deadletterqueue.topic.name` for production resilience
4. **Resource Limits**: Set appropriate memory and CPU limits for the container
5. **Backup Strategy**: Implement regular backups of PostgreSQL database
6. **Security**: Use secrets management for database credentials instead of plain text
7. **High Availability**: Run multiple Kafka Connect workers in the same group for failover

---

## Status: ✅ RESOLVED

- **Connector State**: RUNNING
- **Task State**: RUNNING  
- **Records Synced**: 1000/1000
- **Target Table**: public.RadiusUsers
- **Consumer Group**: connect-jdbc-sink-connector
- **Current Offset**: 1001
