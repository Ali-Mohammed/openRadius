using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

/// <summary>
/// Generates customized Edge Runtime installation scripts.
/// The generated script deploys a self-contained PostgreSQL + Debezium JDBC Sink
/// environment on an edge server that automatically syncs data from the central
/// Kafka/Redpanda cluster.
/// Optionally persists scripts to the database for public URL access.
/// </summary>
public class EdgeRuntimeScriptService : IEdgeRuntimeScriptService
{
    private const string InstallerVersion = "1.0.0";
    private const string DebeziumConnectVersion = "3.0.0.Final";
    private const string PostgresVersion = "18.1";
    private const string ScriptRoutePrefix = "api/debezium/edge-runtime/scripts";

    private readonly MasterDbContext _context;
    private readonly ILogger<EdgeRuntimeScriptService> _logger;

    public EdgeRuntimeScriptService(
        MasterDbContext context,
        ILogger<EdgeRuntimeScriptService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<EdgeRuntimeInstallScriptResponse> GenerateInstallScriptAsync(
        EdgeRuntimeInstallScriptRequest request,
        string baseUrl,
        string? createdBy = null)
    {
        _logger.LogInformation(
            "Generating Edge Runtime install script for instance {InstanceName} with topics {Topics} (SaveToServer={Save})",
            request.InstanceName, request.Topics, request.SaveToServer);

        var sanitizedName = SanitizeName(request.InstanceName);
        var script = BuildScript(request, sanitizedName);
        var description = $"Edge Runtime installer for '{sanitizedName}' — deploys PostgreSQL {PostgresVersion} + Debezium Connect {DebeziumConnectVersion} with JDBC Sink Connector, pre-configured to sync topics [{request.Topics}] from {request.KafkaBootstrapServer}.";

        var response = new EdgeRuntimeInstallScriptResponse
        {
            Script = script,
            InstanceName = sanitizedName,
            Description = description,
            Version = InstallerVersion
        };

        // Persist to database if requested
        if (request.SaveToServer)
        {
            var entity = new EdgeRuntimeScript
            {
                Uuid = Guid.NewGuid(),
                InstanceName = sanitizedName,
                Description = description,
                Version = InstallerVersion,
                ScriptContent = script,
                KafkaBootstrapServer = request.KafkaBootstrapServer,
                Topics = request.Topics,
                ServerName = request.ServerName,
                PostgresPort = request.PostgresPort,
                ConnectPort = request.ConnectPort,
                ConnectorGroupId = request.ConnectorGroupId,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = createdBy
            };

            _context.EdgeRuntimeScripts.Add(entity);
            await _context.SaveChangesAsync();

            var publicUrl = BuildPublicUrl(baseUrl, entity.Uuid);
            response.ScriptId = entity.Uuid;
            response.PublicUrl = publicUrl;
            response.InstallCommand = $"curl -sSL {publicUrl} | sudo bash";
            response.CreatedAt = entity.CreatedAt;

            _logger.LogInformation(
                "Persisted Edge Runtime script {Uuid} for instance {InstanceName} by {CreatedBy}",
                entity.Uuid, sanitizedName, createdBy);
        }

        return response;
    }

    /// <inheritdoc />
    public async Task<EdgeRuntimeScript?> GetScriptByUuidAsync(Guid uuid)
    {
        var script = await _context.EdgeRuntimeScripts
            .FirstOrDefaultAsync(s => s.Uuid == uuid && !s.IsDeleted);

        if (script != null)
        {
            // Increment download counter
            script.DownloadCount++;
            script.LastDownloadedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return script;
    }

    /// <inheritdoc />
    public async Task<List<EdgeRuntimeScriptSummaryDto>> ListScriptsAsync(string baseUrl)
    {
        return await _context.EdgeRuntimeScripts
            .Where(s => !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new EdgeRuntimeScriptSummaryDto
            {
                Uuid = s.Uuid,
                InstanceName = s.InstanceName,
                Description = s.Description,
                Version = s.Version,
                KafkaBootstrapServer = s.KafkaBootstrapServer,
                Topics = s.Topics,
                ServerName = s.ServerName,
                PostgresPort = s.PostgresPort,
                ConnectPort = s.ConnectPort,
                DownloadCount = s.DownloadCount,
                LastDownloadedAt = s.LastDownloadedAt,
                PublicUrl = $"{baseUrl.TrimEnd('/')}/{ScriptRoutePrefix}/{s.Uuid}",
                InstallCommand = $"curl -sSL {baseUrl.TrimEnd('/')}/{ScriptRoutePrefix}/{s.Uuid} | sudo bash",
                CreatedAt = s.CreatedAt,
                CreatedBy = s.CreatedBy
            })
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<bool> DeleteScriptAsync(Guid uuid, string? deletedBy = null)
    {
        var script = await _context.EdgeRuntimeScripts
            .FirstOrDefaultAsync(s => s.Uuid == uuid && !s.IsDeleted);

        if (script == null)
            return false;

        script.IsDeleted = true;
        script.DeletedAt = DateTime.UtcNow;
        script.DeletedBy = deletedBy;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Soft-deleted Edge Runtime script {Uuid} by {DeletedBy}", uuid, deletedBy);
        return true;
    }

    private static string BuildPublicUrl(string baseUrl, Guid uuid)
    {
        return $"{baseUrl.TrimEnd('/')}/{ScriptRoutePrefix}/{uuid}";
    }

    private static string SanitizeName(string name)
    {
        // Only allow alphanumeric, hyphens, and underscores
        var sanitized = System.Text.RegularExpressions.Regex.Replace(name.Trim(), @"[^a-zA-Z0-9_-]", "-");
        return string.IsNullOrWhiteSpace(sanitized) ? "edge-runtime" : sanitized.ToLowerInvariant();
    }

    private static string BuildScript(EdgeRuntimeInstallScriptRequest request, string instanceName)
    {
        var topics = request.Topics;
        var kafkaBootstrap = request.KafkaBootstrapServer;
        var pgPort = request.PostgresPort;
        var connectPort = request.ConnectPort;
        var groupId = request.ConnectorGroupId;

        return $@"#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  OpenRadius Edge Runtime Installer v{InstallerVersion}
#  Instance : {instanceName}
#  Topics   : {topics}
#  Kafka    : {kafkaBootstrap}
# ═══════════════════════════════════════════════════════════════════════════════
#
#  This script installs a self-contained Edge Runtime stack:
#    • PostgreSQL {PostgresVersion} with WAL logical replication
#    • Debezium Connect {DebeziumConnectVersion} with JDBC Sink Connector
#    • Auto-registered sink connector for topic-to-table sync
#
#  Usage:
#    chmod +x install-edge-runtime.sh && ./install-edge-runtime.sh
#
#  Requirements:
#    • Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+, or similar)
#    • Root or sudo access
#    • Internet connectivity
#    • Outbound access to Kafka on port 9092
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
INSTANCE_NAME=""{instanceName}""
INSTALL_DIR=""/opt/openradius-edge/${{INSTANCE_NAME}}""
POSTGRES_PORT={pgPort}
CONNECT_PORT={connectPort}
KAFKA_BOOTSTRAP=""{kafkaBootstrap}""
TOPICS=""{topics}""
CONNECTOR_GROUP_ID={groupId}
POSTGRES_PASSWORD=""$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)""
POSTGRES_DB=""${{INSTANCE_NAME//-/_}}_db""
POSTGRES_USER=""postgres""

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ── Logging ───────────────────────────────────────────────────────────────────
log_info()  {{ echo -e ""${{BLUE}}[INFO]${{NC}}  $1""; }}
log_ok()    {{ echo -e ""${{GREEN}}[OK]${{NC}}    $1""; }}
log_warn()  {{ echo -e ""${{YELLOW}}[WARN]${{NC}}  $1""; }}
log_error() {{ echo -e ""${{RED}}[ERROR]${{NC}} $1""; }}
log_step()  {{ echo -e ""\n${{CYAN}}${{BOLD}}══ $1 ══${{NC}}""; }}

# ── Pre-flight checks ────────────────────────────────────────────────────────
log_step ""OpenRadius Edge Runtime Installer v{InstallerVersion}""
echo ""Instance : $INSTANCE_NAME""
echo ""Kafka    : $KAFKA_BOOTSTRAP""
echo ""Topics   : $TOPICS""
echo ""PG Port  : $POSTGRES_PORT""
echo ""Connect  : $CONNECT_PORT""
echo """"

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error ""This script must be run as root (or with sudo).""
    exit 1
fi

# ── Install Docker ────────────────────────────────────────────────────────────
log_step ""Checking Docker Installation""

install_docker() {{
    log_info ""Installing Docker Engine...""

    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        log_error ""Cannot detect operating system.""
        exit 1
    fi

    case ""$OS"" in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq ca-certificates curl gnupg lsb-release jq openssl >/dev/null 2>&1
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL ""https://download.docker.com/linux/$OS/gpg"" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo ""deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable"" > /etc/apt/sources.list.d/docker.list
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1
            ;;
        centos|rhel|fedora|rocky|almalinux)
            yum install -y -q yum-utils jq openssl >/dev/null 2>&1
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo >/dev/null 2>&1
            yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1
            ;;
        *)
            log_error ""Unsupported OS: $OS. Please install Docker manually.""
            exit 1
            ;;
    esac

    systemctl enable docker --now
    log_ok ""Docker installed successfully.""
}}

if command -v docker &> /dev/null; then
    log_ok ""Docker is already installed: $(docker --version)""
else
    install_docker
fi

# Ensure Docker Compose plugin is available
if ! docker compose version &> /dev/null; then
    log_error ""Docker Compose plugin not found. Please install docker-compose-plugin.""
    exit 1
fi
log_ok ""Docker Compose: $(docker compose version --short)""

# ── Create directory structure ────────────────────────────────────────────────
log_step ""Creating Directory Structure""

mkdir -p ""$INSTALL_DIR""
cd ""$INSTALL_DIR""
log_ok ""Install directory: $INSTALL_DIR""

# ── Generate Dockerfile ──────────────────────────────────────────────────────
log_step ""Generating Dockerfile""

cat > ""$INSTALL_DIR/Dockerfile"" << 'DOCKERFILE_EOF'
FROM debezium/connect:{DebeziumConnectVersion}

# Install JDBC Sink Connector plugin
USER root
RUN cd /kafka/connect && \
    curl -L https://repo1.maven.org/maven2/io/debezium/debezium-connector-jdbc/{DebeziumConnectVersion}/debezium-connector-jdbc-{DebeziumConnectVersion}-plugin.tar.gz | tar xz && \
    chown -R kafka:kafka /kafka/connect

USER kafka
DOCKERFILE_EOF

log_ok ""Dockerfile created.""

# ── Generate init.sql ─────────────────────────────────────────────────────────
log_step ""Generating Database Schema""

cat > ""$INSTALL_DIR/init.sql"" << 'SQL_EOF'
CREATE TABLE IF NOT EXISTS public.""RadiusUsers""
(
    ""Id""                   integer generated by default as identity
        constraint ""PK_RadiusUsers""
            primary key,
    ""ExternalId""           integer                  not null,
    ""Username""             text,
    ""Firstname""            text,
    ""Lastname""             text,
    ""City""                 text,
    ""Phone""                text,
    ""ProfileId""            integer,
    ""Balance""              numeric                  not null,
    ""LoanBalance""          numeric                  not null,
    ""Expiration""           timestamp with time zone,
    ""LastOnline""           timestamp with time zone,
    ""ParentId""             integer,
    ""Email""                text,
    ""StaticIp""             text,
    ""Enabled""              boolean                  not null,
    ""Company""              text,
    ""Notes""                text,
    ""SimultaneousSessions"" integer                  not null,
    ""Address""              text,
    ""ContractId""           text,
    ""NationalId""           text,
    ""MikrotikIpv6Prefix""   text,
    ""GroupId""              integer,
    ""GpsLat""               text,
    ""GpsLng""               text,
    ""Street""               text,
    ""SiteId""               integer,
    ""PinTries""             integer                  not null,
    ""RemainingDays""        integer                  not null,
    ""OnlineStatus""         integer                  not null,
    ""UsedTraffic""          bigint                   not null,
    ""AvailableTraffic""     bigint                   not null,
    ""ParentUsername""       text,
    ""DebtDays""             integer                  not null,
    ""IsDeleted""            boolean                  not null,
    ""DeletedAt""            timestamp with time zone,
    ""WorkspaceId""          integer                  not null,
    ""CreatedAt""            timestamp with time zone not null,
    ""UpdatedAt""            timestamp with time zone not null,
    ""LastSyncedAt""         timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_radiususers_username ON public.""RadiusUsers""(""Username"");
SQL_EOF

log_ok ""Database schema created.""

# ── Generate docker-compose.yml ───────────────────────────────────────────────
log_step ""Generating Docker Compose Configuration""

cat > ""$INSTALL_DIR/docker-compose.yml"" << COMPOSE_EOF
services:
  postgres_${{INSTANCE_NAME//-/_}}:
    image: postgres:{PostgresVersion}
    container_name: postgres_${{INSTANCE_NAME//-/_}}
    command: postgres -c wal_level=logical
    environment:
      POSTGRES_DB: ${{POSTGRES_DB}}
      POSTGRES_USER: ${{POSTGRES_USER}}
      POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD}}
    ports:
      - ""${{POSTGRES_PORT}}:5432""
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - postgres_data:/var/lib/postgresql/data
    networks:
      - edge-network
    restart: unless-stopped
    healthcheck:
      test: [""CMD-SHELL"", ""pg_isready -U postgres""]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: ""json-file""
      options:
        max-size: ""10m""
        max-file: ""3""

  connect_${{INSTANCE_NAME//-/_}}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: connect_${{INSTANCE_NAME//-/_}}
    platform: linux/amd64
    depends_on:
      postgres_${{INSTANCE_NAME//-/_}}:
        condition: service_healthy
    environment:
      BOOTSTRAP_SERVERS: ${{KAFKA_BOOTSTRAP}}
      GROUP_ID: ${{CONNECTOR_GROUP_ID}}
      CONFIG_STORAGE_TOPIC: connect_configs_${{INSTANCE_NAME//-/_}}
      OFFSET_STORAGE_TOPIC: connect_offsets_${{INSTANCE_NAME//-/_}}
      STATUS_STORAGE_TOPIC: connect_status_${{INSTANCE_NAME//-/_}}
      REST_ADVERTISED_HOST_NAME: connect_${{INSTANCE_NAME//-/_}}
      CONNECT_KEY_CONVERTER_SCHEMAS_ENABLE: ""true""
      CONNECT_VALUE_CONVERTER_SCHEMAS_ENABLE: ""true""
      CONNECT_OFFSET_FLUSH_INTERVAL_MS: ""10000""
      CONNECT_OFFSET_FLUSH_TIMEOUT_MS: ""5000""
      CONNECT_STATUS_STORAGE_REPLICATION_FACTOR: ""1""
      CONNECT_CONFIG_STORAGE_REPLICATION_FACTOR: ""1""
      CONNECT_OFFSET_STORAGE_REPLICATION_FACTOR: ""1""
      KAFKA_HEAP_OPTS: ""-Xms512M -Xmx2G""
    ports:
      - ""${{CONNECT_PORT}}:8083""
    networks:
      - edge-network
    restart: unless-stopped
    healthcheck:
      test: [""CMD"", ""curl"", ""-f"", ""http://localhost:8083/""]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G
        reservations:
          cpus: '0.5'
          memory: 1G
    logging:
      driver: ""json-file""
      options:
        max-size: ""10m""
        max-file: ""3""

networks:
  edge-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
COMPOSE_EOF

log_ok ""Docker Compose configuration created.""

# ── Generate JDBC Sink Connector config ───────────────────────────────────────
log_step ""Generating JDBC Sink Connector Configuration""

cat > ""$INSTALL_DIR/jdbc-sink-connector.json"" << CONNECTOR_EOF
{{
  ""name"": ""jdbc-sink-${{INSTANCE_NAME}}"",
  ""config"": {{
    ""connector.class"": ""io.debezium.connector.jdbc.JdbcSinkConnector"",
    ""tasks.max"": ""1"",
    ""topics"": ""${{TOPICS}}"",
    ""connection.url"": ""jdbc:postgresql://postgres_${{INSTANCE_NAME//-/_}}:5432/${{POSTGRES_DB}}"",
    ""connection.username"": ""${{POSTGRES_USER}}"",
    ""connection.password"": ""${{POSTGRES_PASSWORD}}"",
    ""insert.mode"": ""upsert"",
    ""delete.enabled"": ""true"",
    ""primary.key.mode"": ""record_key"",
    ""primary.key.fields"": ""Id"",
    ""auto.create"": ""false"",
    ""auto.evolve"": ""true"",
    ""schema.evolution"": ""basic"",
    ""quote.identifiers"": ""true"",
    ""table.name.format"": ""public.RadiusUsers"",
    ""key.converter"": ""org.apache.kafka.connect.json.JsonConverter"",
    ""value.converter"": ""org.apache.kafka.connect.json.JsonConverter"",
    ""key.converter.schemas.enable"": ""true"",
    ""value.converter.schemas.enable"": ""true"",
    ""errors.tolerance"": ""all"",
    ""errors.log.enable"": ""true"",
    ""errors.log.include.messages"": ""true"",
    ""errors.deadletterqueue.topic.name"": ""dlq-jdbc-sink-${{INSTANCE_NAME}}"",
    ""errors.deadletterqueue.topic.replication.factor"": ""1"",
    ""errors.deadletterqueue.context.headers.enable"": ""true""
  }}
}}
CONNECTOR_EOF

log_ok ""JDBC Sink Connector configuration created.""

# ── Generate register-connector.sh ────────────────────────────────────────────
log_step ""Generating Connector Registration Script""

cat > ""$INSTALL_DIR/register-connector.sh"" << 'REGISTER_EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=""$(cd ""$(dirname ""${{BASH_SOURCE[0]}}"")"" && pwd)""
CONFIG_FILE=""$SCRIPT_DIR/jdbc-sink-connector.json""
CONNECT_URL=""http://localhost:CONNECT_PORT_PLACEHOLDER""

echo ""Waiting for Kafka Connect to be ready...""
RETRIES=0
MAX_RETRIES=60
until curl -sf ""$CONNECT_URL/"" > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        echo ""ERROR: Kafka Connect did not become ready after $MAX_RETRIES attempts.""
        exit 1
    fi
    echo ""  Attempt $RETRIES/$MAX_RETRIES - Kafka Connect is not ready yet...""
    sleep 5
done

echo ""Kafka Connect is ready!""

CONNECTOR_NAME=$(jq -r '.name' ""$CONFIG_FILE"")

if curl -sf ""$CONNECT_URL/connectors/$CONNECTOR_NAME"" > /dev/null 2>&1; then
    echo ""Connector '$CONNECTOR_NAME' already exists. Updating...""
    curl -sf -X PUT ""$CONNECT_URL/connectors/$CONNECTOR_NAME/config"" \
        -H ""Content-Type: application/json"" \
        -d ""$(jq '.config' ""$CONFIG_FILE"")"" | jq .
else
    echo ""Registering connector '$CONNECTOR_NAME'...""
    curl -sf -X POST ""$CONNECT_URL/connectors"" \
        -H ""Content-Type: application/json"" \
        -d @""$CONFIG_FILE"" | jq .
fi

echo """"
echo ""Connector registration complete! Checking status...""
sleep 5
curl -sf ""$CONNECT_URL/connectors/$CONNECTOR_NAME/status"" | jq .
REGISTER_EOF

# Replace the port placeholder
sed -i ""s/CONNECT_PORT_PLACEHOLDER/$CONNECT_PORT/"" ""$INSTALL_DIR/register-connector.sh""
chmod +x ""$INSTALL_DIR/register-connector.sh""

log_ok ""Registration script created.""

# ── Generate management scripts ───────────────────────────────────────────────
log_step ""Generating Management Scripts""

# Start script
cat > ""$INSTALL_DIR/start.sh"" << 'START_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd ""$(dirname ""${{BASH_SOURCE[0]}}"")""
echo ""Starting Edge Runtime...""
docker compose up -d --build
echo ""Waiting for services to initialize (60s)...""
sleep 60
./register-connector.sh
echo """"
echo ""Edge Runtime is running!""
echo ""  PostgreSQL : localhost:PGPORT_PH""
echo ""  Connect API: localhost:CNPORT_PH""
START_EOF

sed -i ""s/PGPORT_PH/$POSTGRES_PORT/"" ""$INSTALL_DIR/start.sh""
sed -i ""s/CNPORT_PH/$CONNECT_PORT/"" ""$INSTALL_DIR/start.sh""
chmod +x ""$INSTALL_DIR/start.sh""

# Stop script
cat > ""$INSTALL_DIR/stop.sh"" << 'STOP_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd ""$(dirname ""${{BASH_SOURCE[0]}}"")""
echo ""Stopping Edge Runtime...""
docker compose down
echo ""Edge Runtime stopped.""
STOP_EOF
chmod +x ""$INSTALL_DIR/stop.sh""

# Status script
cat > ""$INSTALL_DIR/status.sh"" << 'STATUS_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd ""$(dirname ""${{BASH_SOURCE[0]}}"")""
echo ""=== Docker Containers ==""
docker compose ps
echo """"
echo ""=== Connector Status ==""
curl -sf http://localhost:CNPORT_PH/connectors | jq . 2>/dev/null || echo ""Connect API not reachable.""
STATUS_EOF

sed -i ""s/CNPORT_PH/$CONNECT_PORT/"" ""$INSTALL_DIR/status.sh""
chmod +x ""$INSTALL_DIR/status.sh""

# Uninstall script
cat > ""$INSTALL_DIR/uninstall.sh"" << 'UNINSTALL_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd ""$(dirname ""${{BASH_SOURCE[0]}}"")""
echo ""WARNING: This will remove ALL Edge Runtime data including the database!""
read -p ""Are you sure? (yes/no): "" CONFIRM
if [ ""$CONFIRM"" != ""yes"" ]; then
    echo ""Aborted.""
    exit 0
fi
docker compose down -v
echo ""Edge Runtime removed. Install directory preserved at: $(pwd)""
UNINSTALL_EOF
chmod +x ""$INSTALL_DIR/uninstall.sh""

log_ok ""Management scripts created: start.sh, stop.sh, status.sh, uninstall.sh""

# ── Save configuration metadata ──────────────────────────────────────────────
cat > ""$INSTALL_DIR/.edge-runtime.env"" << ENV_EOF
# OpenRadius Edge Runtime Configuration
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Instance: ${{INSTANCE_NAME}}
INSTANCE_NAME=${{INSTANCE_NAME}}
POSTGRES_DB=${{POSTGRES_DB}}
POSTGRES_USER=${{POSTGRES_USER}}
POSTGRES_PASSWORD=${{POSTGRES_PASSWORD}}
POSTGRES_PORT=${{POSTGRES_PORT}}
CONNECT_PORT=${{CONNECT_PORT}}
KAFKA_BOOTSTRAP=${{KAFKA_BOOTSTRAP}}
TOPICS=${{TOPICS}}
CONNECTOR_GROUP_ID=${{CONNECTOR_GROUP_ID}}
ENV_EOF

chmod 600 ""$INSTALL_DIR/.edge-runtime.env""
log_ok ""Configuration saved to .edge-runtime.env""

# ── Build and start ──────────────────────────────────────────────────────────
log_step ""Building & Starting Edge Runtime""

cd ""$INSTALL_DIR""
docker compose up -d --build

log_info ""Waiting for PostgreSQL to become healthy...""
RETRIES=0
MAX_RETRIES=30
until docker compose exec -T ""postgres_${{INSTANCE_NAME//-/_}}"" pg_isready -U postgres > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        log_error ""PostgreSQL did not become ready.""
        docker compose logs ""postgres_${{INSTANCE_NAME//-/_}}"" --tail=20
        exit 1
    fi
    sleep 2
done
log_ok ""PostgreSQL is healthy.""

log_info ""Waiting for Kafka Connect to start (this may take 60-90 seconds)...""
RETRIES=0
MAX_RETRIES=60
until curl -sf ""http://localhost:$CONNECT_PORT/"" > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        log_error ""Kafka Connect did not start within the expected time.""
        docker compose logs ""connect_${{INSTANCE_NAME//-/_}}"" --tail=30
        exit 1
    fi
    sleep 5
done
log_ok ""Kafka Connect is ready.""

# Register the connector
log_step ""Registering JDBC Sink Connector""
./register-connector.sh

# ── Summary ───────────────────────────────────────────────────────────────────
log_step ""Installation Complete! 🎉""
echo """"
echo -e ""${{GREEN}}${{BOLD}}Edge Runtime '$INSTANCE_NAME' is now running!${{NC}}""
echo """"
echo ""  ┌─────────────────────────────────────────────────────────────────┐""
echo ""  │  Service          │  Endpoint                                  │""
echo ""  ├─────────────────────────────────────────────────────────────────┤""
echo ""  │  PostgreSQL       │  localhost:$POSTGRES_PORT                          │""
echo ""  │  Connect REST API │  http://localhost:$CONNECT_PORT                    │""
echo ""  │  Kafka Broker     │  $KAFKA_BOOTSTRAP          │""
echo ""  └─────────────────────────────────────────────────────────────────┘""
echo """"
echo ""  Database Credentials:""
echo ""    Host    : localhost""
echo ""    Port    : $POSTGRES_PORT""
echo ""    Database: $POSTGRES_DB""
echo ""    User    : $POSTGRES_USER""
echo ""    Password: $POSTGRES_PASSWORD""
echo """"
echo ""  Syncing Topics: $TOPICS""
echo """"
echo ""  Management Commands:""
echo ""    Start   : $INSTALL_DIR/start.sh""
echo ""    Stop    : $INSTALL_DIR/stop.sh""
echo ""    Status  : $INSTALL_DIR/status.sh""
echo ""    Remove  : $INSTALL_DIR/uninstall.sh""
echo """"
echo -e ""${{YELLOW}}IMPORTANT: Save the credentials above in a secure location.${{NC}}""
echo -e ""${{YELLOW}}The password was auto-generated and stored in: $INSTALL_DIR/.edge-runtime.env${{NC}}""
echo """"
";
    }
}
