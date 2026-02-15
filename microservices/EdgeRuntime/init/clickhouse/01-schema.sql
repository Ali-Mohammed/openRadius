-- ============================================================================
-- ClickHouse Schema for RADIUS Accounting Analytics
-- Enterprise ISP - High-performance columnar storage
-- ============================================================================

-- ===========================================
-- 1. Main Accounting Table (MergeTree with date partitioning)
-- ===========================================
CREATE TABLE IF NOT EXISTS radius_accounting
(
    -- Session identifiers
    radacctid           UInt64,
    acctsessionid       String,
    acctuniqueid        String,

    -- User info
    username            String,
    realm               String DEFAULT '',

    -- NAS info
    nasipaddress        String,
    nasportid           String DEFAULT '',
    nasporttype         String DEFAULT '',

    -- Timestamps
    acctstarttime       DateTime64(3, 'UTC'),
    acctupdatetime      Nullable(DateTime64(3, 'UTC')),
    acctstoptime        Nullable(DateTime64(3, 'UTC')),

    -- Session metrics
    acctinterval        UInt64 DEFAULT 0,
    acctsessiontime     UInt64 DEFAULT 0,
    acctauthentic       String DEFAULT '',

    -- Connection info
    connectinfo_start   String DEFAULT '',
    connectinfo_stop    String DEFAULT '',

    -- Traffic (bytes)
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

    -- Metadata
    event_type          Enum8('start' = 1, 'interim' = 2, 'stop' = 3, 'on' = 4, 'off' = 5) DEFAULT 'start',
    edge_site_id        String DEFAULT '',
    forwarded_at        DateTime64(3, 'UTC') DEFAULT now64(3),

    -- Partition key (derived)
    event_date          Date DEFAULT toDate(acctstarttime)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (username, acctstarttime, acctsessionid)
TTL event_date + INTERVAL 2 YEAR DELETE
SETTINGS index_granularity = 8192;

-- ===========================================
-- 2. Post-Auth Log (for authentication analytics)
-- ===========================================
CREATE TABLE IF NOT EXISTS radius_postauth
(
    id              UInt64,
    username        String,
    pass            String DEFAULT '',
    reply           String DEFAULT '',
    authdate        DateTime64(3, 'UTC'),
    edge_site_id    String DEFAULT '',
    forwarded_at    DateTime64(3, 'UTC') DEFAULT now64(3),
    event_date      Date DEFAULT toDate(authdate)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (username, authdate)
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
    toStartOfHour(acctstarttime) AS event_hour,
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
    toDate(acctstarttime)        AS event_date,
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
    toDate(authdate)     AS event_date,
    reply,
    countState()         AS auth_count,
    uniqState(username)  AS unique_users
FROM radius_postauth
GROUP BY event_date, reply;

-- ===========================================
-- 4. Useful Views for Querying
-- ===========================================

-- Active sessions (no stop time yet)
CREATE VIEW IF NOT EXISTS v_active_sessions AS
SELECT
    username,
    acctsessionid,
    nasipaddress,
    framedipaddress,
    acctstarttime,
    acctsessiontime,
    acctinputoctets,
    acctoutputoctets,
    calledstationid,
    callingstationid
FROM radius_accounting
WHERE acctstoptime IS NULL
  AND acctstarttime > now() - INTERVAL 24 HOUR
ORDER BY acctstarttime DESC;

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
WHERE acctstarttime > now() - INTERVAL 24 HOUR
GROUP BY username
ORDER BY total_traffic DESC
LIMIT 100;
