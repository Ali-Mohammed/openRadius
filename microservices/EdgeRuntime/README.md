# Edge Runtime - Debezium JDBC Sink Setup

## Overview
This setup uses Debezium JDBC Sink Connector to consume CDC (Change Data Capture) events from Redpanda and write them to a PostgreSQL database.

## Architecture
```
Source DB (with Debezium Source Connector) 
  → Redpanda (Kafka Topic: dbserver1.public.RadiusUsers)
    → Debezium JDBC Sink Connector 
      → PostgreSQL (local1_db)
```

## Components

### 1. PostgreSQL (postgres_local1)
- **Port**: 5434 (host) → 5432 (container)
- **Database**: local1_db
- **WAL Level**: logical (required for CDC)
- **Table**: RadiusUsers

### 2. Debezium Connect (connect_local1)
- **Port**: 8084 (host) → 8083 (container)
- **Bootstrap Servers**: redpanda:9092
- **Connector**: JDBC Sink Connector

## Configuration

### JDBC Sink Connector Settings
- **Topic**: `dbserver1.public.RadiusUsers`
- **Insert Mode**: upsert (insert or update)
- **Delete Enabled**: true
- **Primary Key**: Id
- **Auto Create**: false (table must exist)
- **Auto Evolve**: true (schema changes allowed)

## Usage

### Start Services
```bash
docker-compose up -d
```

### Check Connector Status
```bash
curl http://localhost:8084/connectors/jdbc-sink-connector/status
```

### List All Connectors
```bash
curl http://localhost:8084/connectors
```

### Delete Connector
```bash
curl -X DELETE http://localhost:8084/connectors/jdbc-sink-connector
```

### Manually Register Connector
```bash
curl -X POST http://localhost:8084/connectors \
  -H "Content-Type: application/json" \
  -d @jdbc-sink-connector.json
```

### View Connector Configuration
```bash
curl http://localhost:8084/connectors/jdbc-sink-connector/config | jq
```

## Monitoring

### Check PostgreSQL Data
```bash
docker exec -it postgres_local1 psql -U postgres -d local1_db -c 'SELECT * FROM public."RadiusUsers" LIMIT 10;'
```

### View Connector Logs
```bash
docker logs -f connect_local1
```

### Check Redpanda Topics
```bash
# Assuming you have rpk installed or access to Redpanda container
docker exec -it <redpanda-container> rpk topic list
docker exec -it <redpanda-container> rpk topic consume dbserver1.public.RadiusUsers
```

## Troubleshooting

### Connector Not Starting
1. Check if Redpanda is running and accessible
2. Verify the topic name exists
3. Check connector logs: `docker logs connect_local1`

### Data Not Syncing
1. Verify source connector is publishing to Redpanda
2. Check topic has messages: `rpk topic consume dbserver1.public.RadiusUsers`
3. Check PostgreSQL table exists: `\dt` in psql
4. Review connector status for errors

### Schema Mismatch
- Set `auto.evolve: true` to allow schema evolution
- Or manually alter the PostgreSQL table to match source schema

## Notes
- The connector automatically creates the necessary Kafka Connect topics
- Make sure the external network `openradius_openradius-network` exists
- The source database's Debezium connector should be configured separately
