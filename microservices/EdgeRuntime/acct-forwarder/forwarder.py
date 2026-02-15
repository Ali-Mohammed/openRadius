"""
RADIUS Accounting Forwarder
===========================
Enterprise ISP - EdgeRuntime

Forwards RADIUS accounting records from PostgreSQL (radacct) to ClickHouse.
Uses PostgreSQL LISTEN/NOTIFY for real-time notification + periodic polling
as a fallback to ensure no records are missed.

Architecture:
    FreeRADIUS → PostgreSQL (radacct) → [this forwarder] → ClickHouse (radius_accounting)

The forwarder:
1. Listens for pg_notify('radacct_change') events (triggered by INSERT/UPDATE on radacct)
2. Polls every POLL_INTERVAL_SECONDS for rows where forwarded_to_ch = false
3. Batch-inserts into ClickHouse
4. Marks rows as forwarded_to_ch = true in PostgreSQL

This ensures:
- Real-time forwarding when NOTIFY works
- Reliable catch-up via polling (handles missed notifications, restarts, etc.)
- At-least-once delivery (ClickHouse handles duplicates via acctuniqueid)
"""

import os
import sys
import time
import json
import signal
import logging
import select
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import psycopg2.extensions
from clickhouse_driver import Client as ClickHouseClient

# ============================================================================
# Configuration
# ============================================================================

POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.environ.get("POSTGRES_DB", "edge_db")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "changeme_in_production")

CLICKHOUSE_HOST = os.environ.get("CLICKHOUSE_HOST", "clickhouse")
CLICKHOUSE_PORT = int(os.environ.get("CLICKHOUSE_PORT", "9000"))
CLICKHOUSE_DB = os.environ.get("CLICKHOUSE_DB", "radius_analytics")
CLICKHOUSE_USER = os.environ.get("CLICKHOUSE_USER", "radius")
CLICKHOUSE_PASSWORD = os.environ.get("CLICKHOUSE_PASSWORD", "changeme_in_production")

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "500"))
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info").upper()
EDGE_SITE_ID = os.environ.get("EDGE_SITE_ID", "")

# ============================================================================
# Logging
# ============================================================================

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("acct-forwarder")

# ============================================================================
# Graceful shutdown
# ============================================================================

running = True


def shutdown_handler(signum, frame):
    global running
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    running = False


signal.signal(signal.SIGTERM, shutdown_handler)
signal.signal(signal.SIGINT, shutdown_handler)

# ============================================================================
# Metrics (simple counters)
# ============================================================================

metrics = {
    "total_forwarded": 0,
    "total_batches": 0,
    "total_errors": 0,
    "last_forward_time": None,
    "started_at": datetime.now(timezone.utc).isoformat(),
}

# ============================================================================
# Database connections
# ============================================================================


def connect_postgres() -> psycopg2.extensions.connection:
    """Create a PostgreSQL connection with autocommit for LISTEN."""
    while running:
        try:
            conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                dbname=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                connect_timeout=10,
            )
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            logger.info(f"Connected to PostgreSQL at {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            time.sleep(5)
    raise RuntimeError("Shutting down, could not connect to PostgreSQL")


def connect_clickhouse() -> ClickHouseClient:
    """Create a ClickHouse client connection."""
    while running:
        try:
            client = ClickHouseClient(
                host=CLICKHOUSE_HOST,
                port=CLICKHOUSE_PORT,
                database=CLICKHOUSE_DB,
                user=CLICKHOUSE_USER,
                password=CLICKHOUSE_PASSWORD,
                connect_timeout=10,
                send_receive_timeout=30,
                settings={"insert_deduplicate": 0},
            )
            # Test connection
            client.execute("SELECT 1")
            logger.info(f"Connected to ClickHouse at {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}/{CLICKHOUSE_DB}")
            return client
        except Exception as e:
            logger.error(f"Failed to connect to ClickHouse: {e}")
            time.sleep(5)
    raise RuntimeError("Shutting down, could not connect to ClickHouse")


# ============================================================================
# Forwarding logic
# ============================================================================

FETCH_QUERY = """
    SELECT radacctid, acctsessionid, acctuniqueid, username, realm,
           host(nasipaddress) as nasipaddress, nasportid, nasporttype,
           acctstarttime, acctupdatetime, acctstoptime,
           acctinterval, acctsessiontime, acctauthentic,
           connectinfo_start, connectinfo_stop,
           acctinputoctets, acctoutputoctets,
           calledstationid, callingstationid, acctterminatecause,
           servicetype, framedprotocol,
           COALESCE(host(framedipaddress), '') as framedipaddress
    FROM radacct
    WHERE forwarded_to_ch = false
    ORDER BY radacctid ASC
    LIMIT %s
"""

MARK_FORWARDED_QUERY = """
    UPDATE radacct SET forwarded_to_ch = true WHERE radacctid = ANY(%s)
"""

INSERT_CH_QUERY = """
    INSERT INTO radius_accounting (
        radacctid, acctsessionid, acctuniqueid, username, realm,
        nasipaddress, nasportid, nasporttype,
        acctstarttime, acctupdatetime, acctstoptime,
        acctinterval, acctsessiontime, acctauthentic,
        connectinfo_start, connectinfo_stop,
        acctinputoctets, acctoutputoctets,
        calledstationid, callingstationid, acctterminatecause,
        servicetype, framedprotocol, framedipaddress,
        event_type, edge_site_id
    ) VALUES
"""


def determine_event_type(row: dict) -> str:
    """Determine accounting event type based on session state."""
    if row["acctstoptime"] is not None:
        return "stop"
    elif row["acctupdatetime"] is not None:
        return "interim"
    else:
        return "start"


def safe_str(val) -> str:
    """Convert value to string, handling None."""
    if val is None:
        return ""
    return str(val)


def safe_int(val) -> int:
    """Convert value to int, handling None."""
    if val is None:
        return 0
    return int(val)


def safe_datetime(val) -> Optional[datetime]:
    """Convert value to datetime, handling None."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    return None


def forward_batch(pg_conn, ch_client) -> int:
    """
    Fetch un-forwarded rows from PostgreSQL and insert into ClickHouse.
    Returns the number of rows forwarded.
    """
    # Use a separate connection for the read query (not the LISTEN one)
    with pg_conn.cursor() as cur:
        cur.execute(FETCH_QUERY, (BATCH_SIZE,))
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    if not rows:
        return 0

    # Prepare data for ClickHouse
    ch_rows = []
    pg_ids = []

    for row_tuple in rows:
        row = dict(zip(columns, row_tuple))
        pg_ids.append(row["radacctid"])

        event_type = determine_event_type(row)

        ch_rows.append({
            "radacctid": row["radacctid"],
            "acctsessionid": safe_str(row["acctsessionid"]),
            "acctuniqueid": safe_str(row["acctuniqueid"]),
            "username": safe_str(row["username"]),
            "realm": safe_str(row["realm"]),
            "nasipaddress": safe_str(row["nasipaddress"]),
            "nasportid": safe_str(row["nasportid"]),
            "nasporttype": safe_str(row["nasporttype"]),
            "acctstarttime": row["acctstarttime"] or datetime.now(timezone.utc),
            "acctupdatetime": safe_datetime(row["acctupdatetime"]),
            "acctstoptime": safe_datetime(row["acctstoptime"]),
            "acctinterval": safe_int(row["acctinterval"]),
            "acctsessiontime": safe_int(row["acctsessiontime"]),
            "acctauthentic": safe_str(row["acctauthentic"]),
            "connectinfo_start": safe_str(row["connectinfo_start"]),
            "connectinfo_stop": safe_str(row["connectinfo_stop"]),
            "acctinputoctets": safe_int(row["acctinputoctets"]),
            "acctoutputoctets": safe_int(row["acctoutputoctets"]),
            "calledstationid": safe_str(row["calledstationid"]),
            "callingstationid": safe_str(row["callingstationid"]),
            "acctterminatecause": safe_str(row["acctterminatecause"]),
            "servicetype": safe_str(row["servicetype"]),
            "framedprotocol": safe_str(row["framedprotocol"]),
            "framedipaddress": safe_str(row["framedipaddress"]),
            "event_type": event_type,
            "edge_site_id": EDGE_SITE_ID,
        })

    # Insert into ClickHouse
    ch_client.execute(
        INSERT_CH_QUERY,
        ch_rows,
        types_check=True,
    )

    # Mark as forwarded in PostgreSQL
    with pg_conn.cursor() as cur:
        cur.execute(MARK_FORWARDED_QUERY, (pg_ids,))

    logger.info(f"Forwarded {len(ch_rows)} accounting records to ClickHouse (IDs: {pg_ids[0]}..{pg_ids[-1]})")
    return len(ch_rows)


# ============================================================================
# Main loop
# ============================================================================


def main():
    global metrics

    logger.info("=" * 60)
    logger.info("RADIUS Accounting Forwarder - Starting")
    logger.info(f"  PostgreSQL: {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
    logger.info(f"  ClickHouse: {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}/{CLICKHOUSE_DB}")
    logger.info(f"  Batch size: {BATCH_SIZE}")
    logger.info(f"  Poll interval: {POLL_INTERVAL_SECONDS}s")
    logger.info(f"  Edge site ID: {EDGE_SITE_ID or '(not set)'}")
    logger.info("=" * 60)

    # Connect to databases
    pg_conn = connect_postgres()
    ch_client = connect_clickhouse()

    # Set up LISTEN for real-time notifications
    with pg_conn.cursor() as cur:
        cur.execute("LISTEN radacct_change;")
    logger.info("Listening for radacct_change notifications...")

    last_poll_time = 0

    while running:
        try:
            # -------------------------------------------------------
            # 1. Check for NOTIFY events (non-blocking, 1s timeout)
            # -------------------------------------------------------
            if select.select([pg_conn], [], [], 1.0) != ([], [], []):
                pg_conn.poll()
                while pg_conn.notifies:
                    notify = pg_conn.notifies.pop(0)
                    logger.debug(f"Received NOTIFY: {notify.payload}")

                    # Forward immediately on notification
                    try:
                        count = forward_batch(pg_conn, ch_client)
                        if count > 0:
                            metrics["total_forwarded"] += count
                            metrics["total_batches"] += 1
                            metrics["last_forward_time"] = datetime.now(timezone.utc).isoformat()
                    except Exception as e:
                        metrics["total_errors"] += 1
                        logger.error(f"Error forwarding on NOTIFY: {e}")
                        # Reconnect on error
                        try:
                            ch_client = connect_clickhouse()
                        except Exception:
                            pass

            # -------------------------------------------------------
            # 2. Periodic polling (fallback)
            # -------------------------------------------------------
            current_time = time.time()
            if current_time - last_poll_time >= POLL_INTERVAL_SECONDS:
                last_poll_time = current_time

                try:
                    total_this_poll = 0
                    while running:
                        count = forward_batch(pg_conn, ch_client)
                        if count == 0:
                            break
                        total_this_poll += count
                        metrics["total_forwarded"] += count
                        metrics["total_batches"] += 1
                        metrics["last_forward_time"] = datetime.now(timezone.utc).isoformat()

                    if total_this_poll > 0:
                        logger.info(f"Poll cycle forwarded {total_this_poll} total records")

                except Exception as e:
                    metrics["total_errors"] += 1
                    logger.error(f"Error during poll cycle: {e}")
                    # Try to reconnect
                    try:
                        pg_conn.close()
                    except Exception:
                        pass
                    try:
                        pg_conn = connect_postgres()
                        with pg_conn.cursor() as cur:
                            cur.execute("LISTEN radacct_change;")
                        ch_client = connect_clickhouse()
                    except Exception as reconnect_err:
                        logger.error(f"Reconnection failed: {reconnect_err}")
                        time.sleep(10)

        except Exception as e:
            metrics["total_errors"] += 1
            logger.error(f"Unexpected error in main loop: {e}")
            time.sleep(5)

            # Try to reconnect
            try:
                pg_conn.close()
            except Exception:
                pass
            try:
                pg_conn = connect_postgres()
                with pg_conn.cursor() as cur:
                    cur.execute("LISTEN radacct_change;")
                ch_client = connect_clickhouse()
            except Exception:
                time.sleep(10)

    # Cleanup
    logger.info("Shutting down...")
    logger.info(f"Final metrics: {json.dumps(metrics, indent=2)}")
    try:
        pg_conn.close()
    except Exception:
        pass

    logger.info("Accounting Forwarder stopped.")


if __name__ == "__main__":
    main()
