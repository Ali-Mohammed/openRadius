# OpenRadius Go Testing Suite

Comprehensive RADIUS testing tools written in Go that use real database users for authentication and accounting tests.

## Prerequisites

1. **Go 1.21+**
   ```bash
   brew install go
   ```

2. **FreeRADIUS Client Tools**
   ```bash
   brew install freeradius-server
   ```

3. **PostgreSQL Access**
   - Database should be running and accessible
   - Default connection: `localhost:5432/openradius_workspace_1`

## Installation

```bash
cd /Users/amohammed/Desktop/CodeMe/openRadius/tests
go mod download
```

## Configuration

Set environment variables (optional, defaults provided):

```bash
# Database
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=openradius_workspace_1
export DB_USER=admin
export DB_PASSWORD=admin123

# RADIUS
export RADIUS_SERVER=localhost
export RADIUS_AUTH_PORT=1812
export RADIUS_ACCT_PORT=1813
export RADIUS_SECRET=testing123
export NAS_IP_ADDRESS=192.168.1.10
```

## Available Tests

### 1. Authentication Test

Tests RADIUS authentication for real users from database.

```bash
# Build and run
go build -o test_auth test_auth.go config.go database.go radius.go
./test_auth

# Options
./test_auth -users 50          # Test first 50 users
./test_auth -verbose           # Show detailed output
```

**Output:**
```
========================================
RADIUS Authentication Test
========================================
✓ radtest and radclient are installed
RADIUS Server: localhost:1812
Database: admin@localhost:5432/openradius_workspace_1
✓ Connected to database: openradius_workspace_1
✓ Fetched 50 active users from database

[1/50] Testing user: testuser
  ✓ SUCCESS - User authenticated

[2/50] Testing user: N-328-10-10@hf
  ✓ SUCCESS - User authenticated

========================================
Authentication Test Summary
========================================
Total Tests:    50
✓ Successful:   48
✗ Failed:       2
Success Rate:   96.00%
========================================
```

### 2. Accounting Test

Creates complete accounting sessions (Start, Interim-Update, Stop) for real users.

```bash
# Build and run
go build -o test_accounting test_accounting.go config.go database.go radius.go
./test_accounting

# Options
./test_accounting -users 20    # Create sessions for 20 users
```

**Output:**
```
========================================
RADIUS Accounting Test
========================================
Creating accounting sessions for 20 users...

[1/20] Creating session for: testuser
  → Session ID: test-session-1737052800-10000
  → IP: 10.123.45.67
  → Sending Acct-Start...
  → Sending Interim-Update...
  → Sending Acct-Stop...
  ✓ Session completed: Duration=25m 30s, Download=450.25 MB, Upload=125.50 MB

========================================
Accounting Test Summary
========================================
Total Sessions:     20
✓ Successful:       20
✗ Failed:           0
Success Rate:       100.00%

Data Transfer Summary
========================================
Total Download:     8.50 GB
Total Upload:       2.25 GB
Total Data:         10.75 GB
Total Session Time: 8h 25m 40s
========================================
```

### 3. Load Test

Heavy load testing with concurrent sessions.

```bash
# Build and run
go build -o load_test load_test.go config.go database.go radius.go
./load_test

# Options
./load_test -sessions 500      # Create 500 sessions
./load_test -concurrent 20     # 20 parallel sessions
./load_test -users 100         # Use 100 database users
```

**Output:**
```
========================================
RADIUS Load Test
========================================
Configuration:
  - Total Sessions: 500
  - Concurrent: 20
  - Users: 100

Starting load test...
Progress: 500/500 sessions (100%)

========================================
Load Test Completed!
========================================
Total Sessions:     500
✓ Successful:       498
✗ Failed:           2
Success Rate:       99.60%
Duration:           2m 15s
Sessions/sec:       3.70
Avg Session Time:   270ms
========================================
```

### 4. Simulate Online Users

Keeps users online with periodic Interim-Updates. Great for testing online status tracking.

```bash
# Build and run
go build -o simulate_online simulate_online.go config.go database.go radius.go
./simulate_online

# Options
./simulate_online -online 50       # Simulate 50 concurrent users
./simulate_online -interval 30     # Send updates every 30 seconds
./simulate_online -max-users 200   # Use up to 200 database users
```

**Output:**
```
========================================
Simulate Online Users
========================================
Simulating 50 concurrent users
Interim-update every 60 seconds
Press Ctrl+C to stop

User testuser: Starting session (IP: 10.30.0.0)
  ✓ User testuser is now ONLINE

User N-328-10-10@hf: Starting session (IP: 10.30.0.1)
  ✓ User N-328-10-10@hf is now ONLINE

  ↻ User testuser: Interim-Update sent (Time: 1m 0s, Down: 45.25 MB, Up: 8.50 MB)
  ↻ User N-328-10-10@hf: Interim-Update sent (Time: 1m 0s, Down: 32.10 MB, Up: 5.20 MB)

^C
Received interrupt signal. Stopping all sessions...
User testuser: Stopping session...
  ✓ User testuser session stopped
========================================
All sessions stopped gracefully
========================================
```

## Build All Tests

```bash
# Build all tests at once
./build_all.sh

# Or manually:
go build -o test_auth test_auth.go config.go database.go radius.go
go build -o test_accounting test_accounting.go config.go database.go radius.go
go build -o load_test load_test.go config.go database.go radius.go
go build -o simulate_online simulate_online.go config.go database.go radius.go
```

## Verify Database Data

After running accounting tests, verify data in PostgreSQL:

```bash
# Check radacct table
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT username, acctstarttime, acctstoptime, acctsessiontime, acctinputoctets, acctoutputoctets FROM radacct ORDER BY acctstarttime DESC LIMIT 10;"

# Check online users
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT \"Username\", \"OnlineStatus\", \"LastOnline\" FROM \"RadiusUsers\" WHERE \"OnlineStatus\" = 1;"

# Count total sessions
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT COUNT(*) as total_sessions, SUM(acctinputoctets + acctoutputoctets) as total_bytes FROM radacct;"
```

## Troubleshooting

### Error: "radtest not found"
```bash
brew install freeradius-server
```

### Error: "connection refused"
- Ensure FreeRADIUS container is running: `docker ps | grep freeradius`
- Check ports: `netstat -an | grep 1812`

### Error: "database connection failed"
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check credentials in database

### No users fetched
```sql
-- Verify users exist
docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT COUNT(*) FROM \"RadiusUsers\" WHERE \"IsDeleted\" = false AND \"Enabled\" = true;"
```

## Performance Tips

1. **For large-scale tests**: Increase database connection pool
2. **For faster tests**: Reduce sleep delays in radius.go
3. **For production testing**: Use separate test database
4. **Monitor resources**: Use `htop` and `docker stats` during load tests

## Integration with Backend

These tests populate the `radacct` table, which is used by:
- UserStatusService to update OnlineStatus
- Dashboard statistics
- Usage tracking and reporting
- Daily usage calculations

Run `simulate_online` in the background to test the UserStatusBackgroundService:

```bash
# Terminal 1: Simulate users
./simulate_online -online 30 -interval 30

# Terminal 2: Watch database updates
watch -n 5 'docker exec openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT \"Username\", \"OnlineStatus\", \"LastOnline\" FROM \"RadiusUsers\" WHERE \"OnlineStatus\" = 1 LIMIT 10;"'
```

## License

MIT
