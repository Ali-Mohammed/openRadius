-- ============================================================================
-- ClickHouse Schema for RADIUS Accounting Analytics
-- Enterprise ISP - High-performance columnar storage
--
-- Data source: FreeRADIUS → linelog JSON → Fluent Bit → ClickHouse HTTP
-- Each row represents one accounting event (start / interim / stop / on / off)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS radius_analytics;
USE radius_analytics;

-- ===========================================
-- 1. Main Accounting Table (MergeTree with date partitioning)
-- ===========================================
CREATE TABLE IF NOT EXISTS radius_accounting
(
    -- Event timestamp (Unix epoch from FreeRADIUS %l)
    event_timestamp     UInt64,

    -- Session identifiers
    acctsessionid       String,
    acctuniqueid        String DEFAULT '',

    -- User info
    username            String DEFAULT '',
    realm               String DEFAULT '',

    -- NAS info
    nasipaddress        String DEFAULT '',
    nasportid           String DEFAULT '',
    nasporttype         String DEFAULT '',

    -- Session metrics
    acctsessiontime     UInt64 DEFAULT 0,
    acctauthentic       String DEFAULT '',

    -- Traffic (bytes) — gigaword-adjusted by Fluent Bit Lua filter
    acctinputoctets     UInt64 DEFAULT 0,
    acctoutputoctets    UInt64 DEFAULT 0,

    -- Station IDs
    calledstationid     String DEFAULT '',
    callingstationid    String DEFAULT '',

    -- Session end
    acctterminatecause  String DEFAULT '',

    -- Service info
    servicetype         String DEFAULT '',
    framedprotocol      String DEFAULT '',
    framedipaddress     String DEFAULT '',

    -- Event classification
    event_type          Enum8('start' = 1, 'interim' = 2, 'stop' = 3, 'on' = 4, 'off' = 5) DEFAULT 'start',
    edge_site_id        String DEFAULT '',
    ingested_at         DateTime64(3, 'UTC') DEFAULT now64(3),

    -- Partition key (derived from event_timestamp)
    event_date          Date DEFAULT toDate(toDateTime(event_timestamp))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (username, event_timestamp, acctsessionid)
TTL event_date + INTERVAL 2 YEAR DELETE
SETTINGS index_granularity = 8192;

-- ===========================================
-- 2. Post-Auth Log (for authentication analytics)
-- ===========================================
CREATE TABLE IF NOT EXISTS radius_postauth
(
    event_timestamp UInt64,
    username        String DEFAULT '',
    pass            String DEFAULT '',
    reply           String DEFAULT '',
    edge_site_id    String DEFAULT '',
    ingested_at     DateTime64(3, 'UTC') DEFAULT now64(3),
    event_date      Date DEFAULT toDate(toDateTime(event_timestamp))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (username, event_timestamp)
TTL event_date + INTERVAL 1 YEAR DELETE
SETTINGS index_granularity = 8192;

-- ===========================================
-- 3. Materialized Views for Real-time Analytics
-- ===========================================

-- Hourly traffic summary per user
CREATE TABLE IF NOT EXISTS mv_hourly_traffic
(
    event_hour      DateTime,
    username        String,
    nasipaddress    String,
    total_input     AggregateFunction(sum, UInt64),
    total_output    AggregateFunction(sum, UInt64),
    session_count   AggregateFunction(count),
    total_time      AggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_hour)
ORDER BY (event_hour, username, nasipaddress);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_traffic_view
TO mv_hourly_traffic
AS SELECT
    toStartOfHour(toDateTime(event_timestamp)) AS event_hour,
    username,
    nasipaddress,
    sumState(acctinputoctets)    AS total_input,
    sumState(acctoutputoctets)   AS total_output,
    countState()                 AS session_count,
    sumState(acctsessiontime)    AS total_time
FROM radius_accounting
GROUP BY event_hour, username, nasipaddress;

-- Daily summary per NAS
CREATE TABLE IF NOT EXISTS mv_daily_nas_summary
(
    event_date      Date,
    nasipaddress    String,
    unique_users    AggregateFunction(uniq, String),
    total_sessions  AggregateFunction(count),
    total_input     AggregateFunction(sum, UInt64),
    total_output    AggregateFunction(sum, UInt64),
    total_time      AggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, nasipaddress);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_nas_summary_view
TO mv_daily_nas_summary
AS SELECT
    toDate(toDateTime(event_timestamp)) AS event_date,
    nasipaddress,
    uniqState(username)          AS unique_users,
    countState()                 AS total_sessions,
    sumState(acctinputoctets)    AS total_input,
    sumState(acctoutputoctets)   AS total_output,
    sumState(acctsessiontime)    AS total_time
FROM radius_accounting
GROUP BY event_date, nasipaddress;

-- Daily auth summary (success vs reject)
CREATE TABLE IF NOT EXISTS mv_daily_auth_summary
(
    event_date      Date,
    reply           String,
    auth_count      AggregateFunction(count),
    unique_users    AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, reply);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_auth_summary_view
TO mv_daily_auth_summary
AS SELECT
    toDate(toDateTime(event_timestamp)) AS event_date,
    reply,
    countState()         AS auth_count,
    uniqState(username)  AS unique_users
FROM radius_postauth
GROUP BY event_date, reply;

-- ===========================================
-- 4. Useful Views for Querying
-- ===========================================

-- Active sessions (started in last 24h with no corresponding stop)
-- Uses argMax to get the latest event per session for accurate state
CREATE VIEW IF NOT EXISTS v_active_sessions AS
SELECT
    username,
    acctsessionid,
    nasipaddress,
    framedipaddress,
    toDateTime(max(event_timestamp))          AS last_seen,
    argMax(acctsessiontime, event_timestamp)   AS session_seconds,
    argMax(acctinputoctets, event_timestamp)   AS download_bytes,
    argMax(acctoutputoctets, event_timestamp)  AS upload_bytes,
    argMax(calledstationid, event_timestamp)   AS calledstationid,
    argMax(callingstationid, event_timestamp)  AS callingstationid,
    argMax(event_type, event_timestamp)        AS last_event
FROM radius_accounting
WHERE event_timestamp > toUnixTimestamp(now() - INTERVAL 24 HOUR)
  AND acctsessionid != ''
  AND event_type IN ('start', 'interim')
  AND acctsessionid NOT IN (
      SELECT acctsessionid
      FROM radius_accounting
      WHERE event_type = 'stop'
        AND event_timestamp > toUnixTimestamp(now() - INTERVAL 24 HOUR)
  )
GROUP BY username, acctsessionid, nasipaddress, framedipaddress
ORDER BY last_seen DESC;

-- Online users summary (aggregated per user across all active sessions)
CREATE VIEW IF NOT EXISTS v_online_users AS
SELECT
    username,
    count()                                                  AS active_sessions,
    groupArray(nasipaddress)                                 AS nas_devices,
    groupArray(framedipaddress)                               AS ip_addresses,
    min(last_seen)                                           AS earliest_seen,
    max(last_seen)                                           AS latest_seen,
    sum(session_seconds)                                     AS total_session_seconds,
    formatReadableTimeDelta(sum(session_seconds))             AS total_time,
    sum(download_bytes)                                      AS total_download,
    sum(upload_bytes)                                        AS total_upload,
    formatReadableSize(sum(download_bytes))                   AS download_human,
    formatReadableSize(sum(upload_bytes))                     AS upload_human,
    formatReadableSize(sum(download_bytes) + sum(upload_bytes)) AS total_traffic
FROM v_active_sessions
GROUP BY username
ORDER BY latest_seen DESC;

-- Top users by traffic (last 24 hours)
CREATE VIEW IF NOT EXISTS v_top_users_24h AS
SELECT
    username,
    count()                                         AS session_count,
    sum(acctinputoctets)                             AS total_download,
    sum(acctoutputoctets)                            AS total_upload,
    sum(acctinputoctets) + sum(acctoutputoctets)     AS total_traffic,
    sum(acctsessiontime)                             AS total_time_seconds
FROM radius_accounting
WHERE event_timestamp > toUnixTimestamp(now() - INTERVAL 24 HOUR)
  AND event_type IN ('interim', 'stop')
GROUP BY username
ORDER BY total_traffic DESC
LIMIT 100;
