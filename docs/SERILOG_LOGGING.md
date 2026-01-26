# 📊 Serilog Structured Logging - Complete Guide

## Overview

OpenRadius Payment System now includes enterprise-grade structured logging with **Serilog** and the **Seq** logging UI for real-time log analysis, search, and monitoring.

## 🎯 Features Activated

### 1. **Serilog Integration** ✅
- Structured JSON logging
- Multiple sinks (Console, File, Seq)
- Automatic log enrichment
- Context-aware logging
- Request logging middleware

### 2. **Seq Logging UI** ✅
- Real-time log viewing
- Powerful search and filtering
- Log level filtering
- Property-based queries
- Dashboard and charts
- Free for single-user development

### 3. **Log Outputs**
- **Console**: Formatted, colored output for development
- **File (Text)**: Human-readable logs with rotation
- **File (JSON)**: Structured logs for parsing/analysis
- **Seq**: Real-time UI with search capabilities

## 🚀 Quick Start

### Access the Seq UI

```bash
# Seq is already running via docker-compose
http://localhost:5341
```

**Default Credentials**: No authentication required for local development

### Start the Application

```bash
cd Backend
dotnet run
```

**Console Output:**
```
🚀 Starting OpenRadius Payment System
Environment: Development
✅ OpenRadius Payment System started successfully
📊 Seq Log UI available at: http://localhost:5341
📁 Log files location: Logs/
```

## 📁 Log File Locations

All logs are stored in the `Backend/Logs/` directory:

```
Backend/
├── Logs/
│   ├── openradius-20260126.log      # Human-readable logs
│   ├── openradius-20260126.json     # Structured JSON logs
│   ├── openradius-20260127.log
│   └── openradius-20260127.json
```

### Log Retention
- **Rotation**: Daily (new file each day)
- **Retention**: 30 days
- **Size Limit**: 100MB per JSON file

## 🔍 Using Seq UI

### 1. Basic Navigation

**Open Seq**: http://localhost:5341

**Main Features:**
- **Events**: View all logged events
- **Search**: Filter by text, properties, levels
- **Signals**: Create alerts and notifications
- **Dashboards**: Visualize metrics

### 2. Search Examples

**Filter by Log Level:**
```
@Level = 'Error'
@Level = 'Warning'
@Level = 'Information'
```

**Filter by Source:**
```
SourceContext = 'Backend.Controllers.Payments.PaymentsController'
SourceContext like '%Payment%'
```

**Filter by Properties:**
```
TransactionId = 'abc123'
Amount > 1000
Gateway = 'ZainCash'
```

**Filter by Time:**
```
@Timestamp > Now() - 1h
@Timestamp between (Now() - 24h, Now())
```

**Payment-Specific Queries:**
```
TransactionId is not null
Gateway in ['ZainCash', 'QICard', 'Switch']
Amount >= 250 and Amount <= 149999
Status = 'failed'
```

**Combined Filters:**
```
@Level = 'Error' and Gateway = 'ZainCash'
@Timestamp > Now() - 1h and @Level in ['Warning', 'Error']
```

### 3. Creating Signals (Alerts)

**Example: Alert on Payment Failures**

1. Search: `@Level = 'Error' and SourceContext like '%Payment%'`
2. Click "Save as Signal"
3. Name: "Payment Errors"
4. Configure notifications (optional)

**Example: Monitor High-Value Transactions**

1. Search: `Amount > 100000`
2. Save as Signal: "High Value Payments"

## 📊 Log Enrichment

### Automatic Enrichment

All logs include:
- `Application`: "OpenRadius"
- `MachineName`: Server hostname
- `EnvironmentName`: Development/Production
- `ThreadId`: Thread identifier

### HTTP Request Enrichment

All HTTP requests automatically log:
- `RequestMethod`: GET, POST, etc.
- `RequestPath`: URL path
- `StatusCode`: HTTP status
- `Elapsed`: Response time in ms
- `RequestHost`: Host header
- `RequestScheme`: http/https
- `UserAgent`: Browser/client
- `RemoteIP`: Client IP address

**Example Log Entry:**
```
HTTP POST /api/payments/initiate responded 200 in 125.4567 ms
{
  "RequestHost": "localhost:5000",
  "RequestScheme": "https",
  "UserAgent": "Mozilla/5.0...",
  "RemoteIP": "127.0.0.1",
  "StatusCode": 200,
  "Elapsed": 125.4567
}
```

## 💡 Usage in Code

### Payment Controller Logging

```csharp
// Structured logging example
_logger.LogInformation(
    "Payment initiated: Gateway={Gateway}, TransactionId={TransactionId}, Amount={Amount}, UserId={UserId}",
    gateway, transactionId, amount, userId);

// With specific properties
_logger.LogWarning(
    "Payment initiation failed: Gateway={Gateway}, Error={Error}",
    gateway, errorMessage);

// Error logging with exception
_logger.LogError(ex, 
    "Unexpected error initiating payment: UserId={UserId}, Gateway={Gateway}",
    userId, gateway);
```

### Log Levels

```csharp
Log.Verbose("Detailed diagnostic info");
Log.Debug("Debug-level events");
Log.Information("General informational events");
Log.Warning("Warning-level events");
Log.Error("Error-level events");
Log.Fatal("Fatal errors causing shutdown");
```

### Contextual Logging

```csharp
using (LogContext.PushProperty("TransactionId", transactionId))
{
    _logger.LogInformation("Processing payment");
    // TransactionId will be included in all logs within this scope
}
```

## 🎨 Log Output Formats

### Console Output
```
[14:23:45 INF] Backend.Controllers.Payments.PaymentsController
Payment initiated successfully: Gateway=ZainCash, TransactionId=abc123, Amount=1000, UserId=42
```

### File Output (Text)
```
[2026-01-26 14:23:45.123 +00:00] [INF] Backend.Controllers.Payments.PaymentsController
Payment initiated successfully: Gateway=ZainCash, TransactionId=abc123, Amount=1000, UserId=42
```

### File Output (JSON)
```json
{
  "@t": "2026-01-26T14:23:45.1234567Z",
  "@mt": "Payment initiated successfully: Gateway={Gateway}, TransactionId={TransactionId}, Amount={Amount}, UserId={UserId}",
  "@l": "Information",
  "Gateway": "ZainCash",
  "TransactionId": "abc123",
  "Amount": 1000,
  "UserId": 42,
  "SourceContext": "Backend.Controllers.Payments.PaymentsController",
  "Application": "OpenRadius",
  "MachineName": "dev-server",
  "EnvironmentName": "Development"
}
```

## ⚙️ Configuration

### appsettings.json

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning",
        "Backend.Controllers.Payments": "Information",
        "Backend.Services": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "Console"
      },
      {
        "Name": "File",
        "Args": {
          "path": "Logs/openradius-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 30
        }
      },
      {
        "Name": "Seq",
        "Args": {
          "serverUrl": "http://localhost:5341"
        }
      }
    ],
    "Enrich": [ "FromLogContext", "WithEnvironmentName", "WithMachineName" ]
  }
}
```

### Change Log Levels at Runtime

Edit `appsettings.json` and the application will reload configuration:

```json
"Override": {
  "Backend.Controllers.Payments": "Debug",  // More verbose
  "Backend.Services": "Warning"             // Less verbose
}
```

## 📈 Monitoring & Analytics

### Key Metrics to Monitor in Seq

1. **Error Rate**
   - Query: `@Level = 'Error'`
   - Create chart by hour

2. **Payment Success Rate**
   - Query: `SourceContext like '%Payment%' and Status = 'completed'`

3. **Response Times**
   - Query: `Elapsed > 1000` (responses over 1 second)

4. **Gateway Performance**
   - Group by: `Gateway`
   - Measure: Count, Average `Elapsed`

5. **Circuit Breaker Events**
   - Query: `@Message like '%Circuit breaker%'`

### Creating a Dashboard

1. Go to **Dashboards** in Seq
2. Click **New Dashboard**
3. Add charts:
   - **Error Count**: `@Level = 'Error'` (count over time)
   - **Payment Volume**: `Gateway is not null` (count by Gateway)
   - **Avg Response Time**: `Elapsed` (average over time)
   - **Failed Payments**: `Status = 'failed'` (count over time)

## 🔔 Alerting

### Email Alerts (Requires Seq License)

**Free Alternative**: Use Signals to export to external monitoring

### Webhook Integration

Configure webhooks in Seq to send alerts to:
- Slack
- Microsoft Teams  
- Discord
- Custom webhook endpoints

## 🐛 Troubleshooting

### Logs Not Appearing in Seq

**Check Seq is running:**
```bash
docker ps | grep seq
curl http://localhost:5341/api
```

**Check connection in logs:**
```bash
cd Backend
grep -i "seq" Logs/openradius-*.log
```

**Restart Seq:**
```bash
docker-compose restart seq
```

### File Permissions

Ensure `Logs/` directory is writable:
```bash
cd Backend
mkdir -p Logs
chmod 755 Logs
```

### Too Many Logs

**Reduce verbosity** in `appsettings.json`:
```json
"MinimumLevel": {
  "Default": "Warning"  // Changed from "Information"
}
```

## 🎯 Best Practices

### 1. Use Structured Logging

✅ **Good:**
```csharp
_logger.LogInformation(
    "Payment failed: TransactionId={TransactionId}, Error={Error}",
    transactionId, error);
```

❌ **Bad:**
```csharp
_logger.LogInformation($"Payment failed: {transactionId} - {error}");
```

### 2. Include Context

Always include relevant properties:
- TransactionId
- UserId
- Gateway
- Amount
- Status

### 3. Appropriate Log Levels

- **Verbose**: Detailed diagnostic (usually disabled)
- **Debug**: Development debugging
- **Information**: General flow (default)
- **Warning**: Concerning but non-critical
- **Error**: Failures requiring attention
- **Fatal**: Application-ending errors

### 4. Don't Log Sensitive Data

❌ **Never log:**
- Passwords
- API keys
- Credit card numbers
- Personal identification numbers
- JWT tokens (full)

✅ **Safe to log:**
- Transaction IDs
- Gateway names
- Amounts
- Timestamps
- Status codes

### 5. Use Scoped Logging

```csharp
using (_logger.BeginScope("TransactionId:{TransactionId}", transactionId))
{
    // All logs here will include TransactionId
    _logger.LogInformation("Processing payment");
    _logger.LogInformation("Calling gateway");
}
```

## 📊 Production Deployment

### Seq Production Setup

**Option 1: Self-Hosted Seq**
```bash
# Update docker-compose.yml for production
seq:
  image: datalust/seq:2025.1
  environment:
    ACCEPT_EULA: Y
    SEQ_FIRSTRUN_ADMINPASSWORD: YourSecurePassword123!
  volumes:
    - /path/to/persistent/storage:/data
  restart: unless-stopped
```

**Option 2: Seq Cloud** (Recommended)
- Sign up at https://datalust.co/seq
- Get API key
- Update Seq configuration:

```json
{
  "Name": "Seq",
  "Args": {
    "serverUrl": "https://yourinstance.seq.datalust.co",
    "apiKey": "your-api-key-here"
  }
}
```

### Alternative Log Aggregation

**Elasticsearch + Kibana:**
```bash
dotnet add package Serilog.Sinks.Elasticsearch
```

**Application Insights:**
```bash
dotnet add package Serilog.Sinks.ApplicationInsights
```

**Datadog:**
```bash
dotnet add package Serilog.Sinks.Datadog.Logs
```

## 📚 Resources

- **Serilog**: https://serilog.net/
- **Seq**: https://datalust.co/seq
- **Serilog Best Practices**: https://github.com/serilog/serilog/wiki/Best-Practices
- **Seq Query Language**: https://docs.datalust.co/docs/query-syntax

## 🎓 Quick Reference

### Common Queries

| Query | Purpose |
|-------|---------|
| `@Level = 'Error'` | All errors |
| `Gateway = 'ZainCash'` | ZainCash payments |
| `Elapsed > 1000` | Slow requests (>1s) |
| `@Exception is not null` | Exceptions only |
| `Amount > 100000` | High-value transactions |
| `Status = 'failed'` | Failed payments |
| `@Timestamp > Now() - 1h` | Last hour |

### Keyboard Shortcuts (Seq)

- `Ctrl+K`: Focus search
- `Ctrl+Enter`: Execute search
- `Esc`: Clear search
- `/`: Quick filter

---

**Version**: 1.0.0  
**Last Updated**: January 26, 2026  
**Status**: ✅ Production Ready
