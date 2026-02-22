#!/bin/bash

# =============================================================================
# OpenRadius Edge Runtime — Enterprise Installation Script
# =============================================================================
# This script installs and configures an OpenRadius Edge Runtime stack on a
# remote edge server. The edge runtime synchronizes data in real-time from the
# central OpenRadius Kafka/Redpanda cluster via Debezium JDBC Sink Connector.
#
# Components Installed:
#   • Docker & Docker Compose (if not present)
#   • PostgreSQL 18.1 with WAL logical replication
#   • Debezium Connect 3.0.0.Final with JDBC Sink Connector
#   • RadiusSyncService — .NET 10 microservice for Docker monitoring,
#     remote management, and real-time SignalR communication with central
#   • FreeRADIUS 3.2 (optional — for local RADIUS authentication)
#   • Management scripts (start, stop, status, backup, uninstall)
#
# Usage:
#   Interactive:    sudo ./install-edge-runtime.sh
#   Unattended:     sudo ./install-edge-runtime.sh --unattended --config /path/to/edge.env
#   Resume failed:  sudo ./install-edge-runtime.sh --resume
#   Specific step:  sudo ./install-edge-runtime.sh --resume --from start_services
#
# Exit Codes:
#   0   Success
#   1   General / unknown error
#   10  Pre-flight check failed (disk, RAM, CPU, connectivity)
#   11  OS not supported
#   12  Missing root / sudo privileges
#   20  Docker installation failed
#   21  Docker Compose installation failed
#   22  Prerequisites installation failed
#   30  Configuration validation failed
#   31  Unattended config file not found or invalid
#   40  Kafka connectivity check failed
#   50  Docker image build/pull failed
#   60  Service startup failed
#   61  Health check timeout
#   70  Connector registration failed
#   80  FreeRADIUS configuration failed (non-fatal)
#   90  Cleanup / rollback in progress
#
# Enterprise Architecture:
#   The edge runtime receives CDC events from the central server's Kafka/Redpanda
#   broker (port 9094, SASL/SCRAM authenticated) and stores them in a local
#   PostgreSQL database. This enables:
#     - Offline-capable branch operations
#     - Low-latency local RADIUS authentication
#     - Eventual consistency with the central database
#
# Powered By: Ali Al-Estarbadee
# Email: ali87mohammed@hotmail.com
# =============================================================================

# Version
EDGE_RUNTIME_VERSION="1.3.0"
DEBEZIUM_CONNECT_VERSION="3.0.0.Final"
POSTGRES_VERSION="18.1"
DOTNET_RUNTIME_VERSION="10.0"
RADIUS_SYNC_SERVICE_VERSION="1.0.0"

# =============================================================================
# Strict Mode & Globals
# =============================================================================
set -o pipefail

INSTALL_DIR=""
INSTANCE_NAME=""
LOG_FILE=""
CHECKPOINT_FILE=""
UNATTENDED=false
RESUME=false
RESUME_FROM=""
CONFIG_FILE=""
INSTALL_START_TIME=$(date +%s)

# Configuration variables (populated during collect_configuration)
KAFKA_BOOTSTRAP_SERVER=""
KAFKA_SASL_USERNAME=""
KAFKA_SASL_PASSWORD=""
TOPICS=""
SERVER_NAME=""
POSTGRES_PORT="5434"
CONNECT_PORT="8084"
CONNECTOR_GROUP_ID="2"
POSTGRES_PASSWORD=""
POSTGRES_DB=""
POSTGRES_USER="postgres"
INSTALL_FREERADIUS="n"
INSTALL_SYNC_SERVICE="y"
SYNC_SERVICE_PORT="5242"
SIGNALR_HUB_URL=""
EDGE_SITE_ID=""
NAS_SECRET=""
CENTRAL_API_URL=""
ENABLE_MONITORING="n"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# =============================================================================
# Logging Infrastructure
# =============================================================================

init_logging() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    # Rotate old log if > 10MB
    if [[ -f "$LOG_FILE" ]] && [[ $(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]]; then
        mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d-%H%M%S).bak"
    fi
    {
        echo ""
        echo "# ================================================================"
        echo "# OpenRadius Edge Runtime Installation — $(date -Iseconds 2>/dev/null || date)"
        echo "# Version: $EDGE_RUNTIME_VERSION"
        echo "# Hostname: $(hostname -f 2>/dev/null || hostname)"
        echo "# Kernel: $(uname -r)"
        echo "# User: $(whoami) (UID=$EUID)"
        echo "# Command: $0 $*"
        echo "# ================================================================"
    } >> "$LOG_FILE"
}

log() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "[$(date -Iseconds 2>/dev/null || date)] $*" >> "$LOG_FILE" 2>/dev/null || true
}

log_debug() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "[$(date -Iseconds 2>/dev/null || date)] [DEBUG] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    local msg="$1"
    echo -e "\n${PURPLE}================================================================================================${NC}"
    echo -e "${PURPLE}  $msg${NC}"
    echo -e "${PURPLE}================================================================================================${NC}\n"
    log "===== $msg ====="
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
    log "[OK]    $1"
}

print_error() {
    echo -e "${RED}  ✗ $1${NC}"
    log "[ERROR] $1"
}

print_warning() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
    log "[WARN]  $1"
}

print_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
    log "[INFO]  $1"
}

print_step() {
    echo -e "${BLUE}  ➜ $1${NC}"
    log "[STEP]  $1"
}

# Divider
print_divider() {
    echo -e "${GRAY}  ────────────────────────────────────────────────────────────────${NC}"
}

# Generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $((length * 2)) | tr -d "=+/" | cut -c1-"$length"
}

# Validate IP address or hostname
validate_host() {
    local host=$1
    # Allow IP addresses
    if [[ $host =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        return 0
    fi
    # Allow hostnames with optional port
    if [[ $host =~ ^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$ ]]; then
        return 0
    fi
    # Allow host:port format
    if [[ $host =~ ^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?:[0-9]+$ ]]; then
        return 0
    fi
    return 1
}

# Validate instance name (lowercase alphanumeric, hyphens, underscores)
validate_instance_name() {
    local name=$1
    if [[ ! $name =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]]; then
        return 1
    fi
    return 0
}

# Validate port number (1024-65535)
validate_port() {
    local port=$1
    if [[ $port =~ ^[0-9]+$ ]] && [[ $port -ge 1024 ]] && [[ $port -le 65535 ]]; then
        return 0
    fi
    return 1
}

# =============================================================================
# Error Handling & Cleanup Trap
# =============================================================================

CURRENT_STEP=""
LAST_EXIT_CODE=0

cleanup_on_error() {
    LAST_EXIT_CODE=$?
    if [[ $LAST_EXIT_CODE -eq 0 ]]; then
        return
    fi

    echo ""
    print_error "Installation failed during step: ${CURRENT_STEP:-unknown}"
    print_error "Exit code: $LAST_EXIT_CODE"
    log "[FATAL] Installation failed at step '${CURRENT_STEP:-unknown}' with exit code $LAST_EXIT_CODE"

    # Save checkpoint for resume
    if [[ -n "$CURRENT_STEP" ]]; then
        save_checkpoint "$CURRENT_STEP"
        print_info "Checkpoint saved. Resume with:"
        print_info "  sudo ./install-edge-runtime.sh --resume"
    fi

    # Diagnostics
    print_info "Diagnostics:"
    print_info "  Install log: $LOG_FILE"
    print_info "  Last 20 lines of log:"
    tail -20 "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
        echo -e "    ${GRAY}$line${NC}"
    done

    # Show Docker status if relevant
    if command -v docker &>/dev/null && [[ -n "$INSTALL_DIR" ]] && [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
        local running
        running=$(cd "$INSTALL_DIR" && docker compose ps --format '{{.Names}} ({{.Status}})' 2>/dev/null | head -5)
        if [[ -n "$running" ]]; then
            print_info "  Running containers:"
            echo "$running" | while IFS= read -r line; do
                echo -e "    ${GRAY}$line${NC}"
            done
        fi
    fi

    echo ""
    print_warning "To retry from the failed step: sudo ./install-edge-runtime.sh --resume"
    print_warning "To start fresh: sudo ./install-edge-runtime.sh"
    echo ""

    exit $LAST_EXIT_CODE
}

trap cleanup_on_error EXIT

# =============================================================================
# Step Runner with Checkpoint Tracking
# =============================================================================

run_step() {
    local step_name="$1"
    local step_func="$2"

    # If resuming, skip completed steps
    if [[ "$RESUME" == "true" && -f "$CHECKPOINT_FILE" ]]; then
        local completed
        completed=$(grep "^COMPLETED:" "$CHECKPOINT_FILE" | cut -d: -f2)
        if echo "$completed" | grep -qw "$step_name"; then
            print_info "Skipping (already completed): $step_name"
            log "[SKIP]  $step_name (checkpoint: already completed)"
            return 0
        fi
        # If --from is set, skip until we reach it
        if [[ -n "$RESUME_FROM" ]]; then
            if [[ "$step_name" != "$RESUME_FROM" ]]; then
                print_info "Skipping (resume target not reached): $step_name"
                return 0
            else
                RESUME_FROM=""  # Found it, run from here
            fi
        fi
    fi

    CURRENT_STEP="$step_name"
    log "[BEGIN] $step_name"
    local step_start
    step_start=$(date +%s)

    # Run the step
    $step_func

    local step_end
    step_end=$(date +%s)
    local step_duration=$((step_end - step_start))
    log "[END]   $step_name (${step_duration}s)"
    mark_checkpoint_complete "$step_name"
    CURRENT_STEP=""
}

# =============================================================================
# Checkpoint System
# =============================================================================

save_checkpoint() {
    local failed_step="$1"
    mkdir -p "$(dirname "$CHECKPOINT_FILE")" 2>/dev/null || true

    {
        echo "# OpenRadius Edge Runtime Install Checkpoint — $(date -Iseconds 2>/dev/null || date)"
        echo "FAILED_AT:$failed_step"
        # Save all configuration variables for resume
        for var in INSTANCE_NAME KAFKA_BOOTSTRAP_SERVER KAFKA_SASL_USERNAME KAFKA_SASL_PASSWORD \
                   TOPICS SERVER_NAME POSTGRES_PORT CONNECT_PORT CONNECTOR_GROUP_ID \
                   POSTGRES_PASSWORD POSTGRES_DB POSTGRES_USER INSTALL_FREERADIUS \
                   EDGE_SITE_ID NAS_SECRET CENTRAL_API_URL ENABLE_MONITORING \
                   INSTALL_DIR LOG_FILE CHECKPOINT_FILE; do
            if [[ -n "${!var}" ]]; then
                echo "VAR:${var}=${!var}"
            fi
        done
        # Preserve completed steps from previous checkpoint
        if [[ -f "$CHECKPOINT_FILE" ]]; then
            grep "^COMPLETED:" "$CHECKPOINT_FILE"
        fi
    } > "${CHECKPOINT_FILE}.tmp"
    mv "${CHECKPOINT_FILE}.tmp" "$CHECKPOINT_FILE"
    chmod 600 "$CHECKPOINT_FILE"
    log "[CHECKPOINT] Saved at step: $failed_step"
}

mark_checkpoint_complete() {
    local step_name="$1"
    mkdir -p "$(dirname "$CHECKPOINT_FILE")" 2>/dev/null || true
    if [[ -f "$CHECKPOINT_FILE" ]]; then
        echo "COMPLETED:$step_name" >> "$CHECKPOINT_FILE" 2>/dev/null || true
    else
        echo "COMPLETED:$step_name" > "$CHECKPOINT_FILE" 2>/dev/null || true
        chmod 600 "$CHECKPOINT_FILE" 2>/dev/null || true
    fi
}

load_checkpoint() {
    if [[ ! -f "$CHECKPOINT_FILE" ]]; then
        # Try default location
        local default_ckpt="/opt/openradius-edge/.install-checkpoint"
        if [[ -f "$default_ckpt" ]]; then
            CHECKPOINT_FILE="$default_ckpt"
        else
            print_error "No checkpoint file found."
            print_info "Run without --resume for a fresh installation."
            exit 31
        fi
    fi

    print_info "Loading checkpoint from previous installation..."
    log "[CHECKPOINT] Loading from $CHECKPOINT_FILE"

    # Restore variables
    while IFS= read -r line; do
        if [[ "$line" == VAR:* ]]; then
            local kv="${line#VAR:}"
            local key="${kv%%=*}"
            local val="${kv#*=}"
            export "$key=$val"
            log_debug "Restored variable: $key"
        fi
    done < "$CHECKPOINT_FILE"

    # Re-derive paths from restored INSTANCE_NAME
    if [[ -n "$INSTANCE_NAME" ]]; then
        INSTALL_DIR="${INSTALL_DIR:-/opt/openradius-edge/$INSTANCE_NAME}"
        LOG_FILE="${LOG_FILE:-$INSTALL_DIR/install.log}"
    fi

    local failed_at
    failed_at=$(grep "^FAILED_AT:" "$CHECKPOINT_FILE" | tail -1 | cut -d: -f2)
    local completed_count
    completed_count=$(grep -c "^COMPLETED:" "$CHECKPOINT_FILE" || true)
    print_success "Checkpoint loaded: $completed_count steps completed, failed at: $failed_at"

    # If no explicit --from, resume from the failed step
    if [[ -z "$RESUME_FROM" ]]; then
        RESUME_FROM="$failed_at"
    fi
}

# =============================================================================
# Parse Command-Line Arguments
# =============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --unattended|-u)
                UNATTENDED=true
                shift
                ;;
            --config|-c)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --resume|-r)
                RESUME=true
                shift
                ;;
            --from)
                RESUME_FROM="$2"
                shift 2
                ;;
            --log)
                LOG_FILE="$2"
                shift 2
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            --version|-v)
                echo "OpenRadius Edge Runtime Installer v${EDGE_RUNTIME_VERSION}"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

show_usage() {
    cat << 'EOF'
Usage: sudo ./install-edge-runtime.sh [OPTIONS]

  Installs the OpenRadius Edge Runtime — a self-contained PostgreSQL +
  Debezium Connect stack that syncs data from the central Kafka/Redpanda
  cluster to a local edge database.

Options:
  --unattended, -u        Non-interactive mode (requires --config)
  --config, -c FILE       Path to config file for unattended install
  --resume, -r            Resume a previously failed installation
  --from STEP             Resume from a specific step (use with --resume)
  --log FILE              Custom log file path
  --version, -v           Show version and exit
  --help, -h              Show this help message

Unattended Config File Format (edge-config.env):
  INSTANCE_NAME=branch-office-1
  KAFKA_BOOTSTRAP_SERVER=kafka.example.com:9094
  KAFKA_SASL_USERNAME=admin
  KAFKA_SASL_PASSWORD=your_kafka_password
  TOPICS=workspace_1.public.RadiusUsers,workspace_1.public.RadiusProfiles
  SERVER_NAME=workspace_1
  POSTGRES_PORT=5434
  CONNECT_PORT=8084
  CONNECTOR_GROUP_ID=2
  EDGE_SITE_ID=edge-1
  INSTALL_FREERADIUS=n
  ENABLE_MONITORING=n
  CENTRAL_API_URL=https://api.example.com

Examples:
  # Fresh interactive install
  sudo ./install-edge-runtime.sh

  # Unattended install
  sudo ./install-edge-runtime.sh --unattended --config /root/edge-config.env

  # Resume after failure
  sudo ./install-edge-runtime.sh --resume

  # Resume from a specific step
  sudo ./install-edge-runtime.sh --resume --from start_services

Steps (for --from):
  preflight_checks, install_docker, install_prerequisites,
  collect_configuration, verify_kafka_connectivity, generate_configs,
  generate_management_scripts, build_images, start_services,
  wait_for_health, register_connector, configure_freeradius,
  save_credentials, setup_monitoring
EOF
}

# =============================================================================
# Unattended Mode — Load Config File
# =============================================================================

load_unattended_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Config file not found: $CONFIG_FILE"
        exit 31
    fi

    print_info "Loading unattended configuration from: $CONFIG_FILE"
    log "[UNATTENDED] Loading config from $CONFIG_FILE"

    # Source the config file (key=value format)
    set -a
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    set +a

    # Validate required fields
    local missing=()
    [[ -z "${INSTANCE_NAME:-}" ]] && missing+=("INSTANCE_NAME")
    [[ -z "${KAFKA_BOOTSTRAP_SERVER:-}" ]] && missing+=("KAFKA_BOOTSTRAP_SERVER")
    [[ -z "${KAFKA_SASL_PASSWORD:-}" ]] && missing+=("KAFKA_SASL_PASSWORD")
    [[ -z "${TOPICS:-}" ]] && missing+=("TOPICS")
    [[ -z "${SERVER_NAME:-}" ]] && missing+=("SERVER_NAME")

    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required fields in config file: ${missing[*]}"
        exit 31
    fi

    if ! validate_instance_name "$INSTANCE_NAME"; then
        print_error "Invalid instance name: $INSTANCE_NAME (lowercase alphanumeric, hyphens, underscores only)"
        exit 30
    fi

    # Apply defaults
    : "${KAFKA_SASL_USERNAME:=admin}"
    : "${POSTGRES_PORT:=5434}"
    : "${CONNECT_PORT:=8084}"
    : "${CONNECTOR_GROUP_ID:=2}"
    : "${EDGE_SITE_ID:=$INSTANCE_NAME}"
    : "${INSTALL_FREERADIUS:=n}"
    : "${INSTALL_SYNC_SERVICE:=y}"
    : "${SYNC_SERVICE_PORT:=5242}"
    : "${SIGNALR_HUB_URL:=}"
    : "${ENABLE_MONITORING:=n}"
    : "${CENTRAL_API_URL:=}"

    # Derive paths
    INSTALL_DIR="/opt/openradius-edge/$INSTANCE_NAME"
    LOG_FILE="$INSTALL_DIR/install.log"
    CHECKPOINT_FILE="$INSTALL_DIR/.install-checkpoint"

    # Auto-generate secrets
    POSTGRES_PASSWORD=$(generate_password 32)
    POSTGRES_DB="${INSTANCE_NAME//-/_}_db"
    NAS_SECRET="${NAS_SECRET:-$(generate_password 16)}"

    print_success "Unattended configuration loaded and validated"
}

# =============================================================================
# Pre-Flight Checks
# =============================================================================

preflight_checks() {
    print_header "PRE-FLIGHT CHECKS"
    local warnings=0
    local errors=0

    # --- Disk Space ---
    local disk_avail_kb
    disk_avail_kb=$(df /opt 2>/dev/null | awk 'NR==2 {print $4}' || df / | awk 'NR==2 {print $4}')
    local disk_avail_gb=$((disk_avail_kb / 1024 / 1024))
    if [[ $disk_avail_gb -lt 5 ]]; then
        print_error "Insufficient disk space: ${disk_avail_gb}GB available (minimum: 5GB)"
        errors=$((errors + 1))
    elif [[ $disk_avail_gb -lt 10 ]]; then
        print_warning "Low disk space: ${disk_avail_gb}GB available (recommended: 10GB+)"
        warnings=$((warnings + 1))
    else
        print_success "Disk space: ${disk_avail_gb}GB available"
    fi

    # --- RAM ---
    local ram_total_kb
    ram_total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local ram_total_mb=$((ram_total_kb / 1024))
    if [[ $ram_total_mb -lt 2000 ]]; then
        print_error "Insufficient RAM: ${ram_total_mb}MB (minimum: 2GB)"
        errors=$((errors + 1))
    elif [[ $ram_total_mb -lt 4000 ]]; then
        print_warning "RAM: ${ram_total_mb}MB (recommended: 4GB+ for production)"
        warnings=$((warnings + 1))
    else
        print_success "RAM: ${ram_total_mb}MB"
    fi

    # --- CPU Cores ---
    local cpu_cores
    cpu_cores=$(nproc 2>/dev/null || echo 1)
    if [[ $cpu_cores -lt 2 ]]; then
        print_warning "CPU: $cpu_cores core(s) (recommended: 2+)"
        warnings=$((warnings + 1))
    else
        print_success "CPU: $cpu_cores cores"
    fi

    # --- Port Availability ---
    for port in $POSTGRES_PORT $CONNECT_PORT; do
        if ss -tlnp 2>/dev/null | grep -q ":${port} " || netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
            local proc
            proc=$(ss -tlnp 2>/dev/null | grep ":${port} " | awk '{print $NF}' | head -1)
            print_error "Port $port is already in use by: $proc"
            errors=$((errors + 1))
        else
            print_success "Port $port: available"
        fi
    done

    if [[ "$INSTALL_FREERADIUS" == "y" ]]; then
        for port in 1812 1813; do
            if ss -ulnp 2>/dev/null | grep -q ":${port} "; then
                print_warning "Port $port (RADIUS) is in use"
                warnings=$((warnings + 1))
            else
                print_success "Port $port (RADIUS): available"
            fi
        done
    fi

    # --- Required Commands ---
    for cmd in curl openssl; do
        if command -v "$cmd" &>/dev/null; then
            print_success "Command: $cmd ✓"
        else
            print_warning "Command: $cmd not found (will be installed)"
            warnings=$((warnings + 1))
        fi
    done

    # --- Internet Connectivity ---
    if curl -s --connect-timeout 5 https://hub.docker.com > /dev/null 2>&1; then
        print_success "Internet: reachable (hub.docker.com)"
    elif curl -s --connect-timeout 5 https://github.com > /dev/null 2>&1; then
        print_success "Internet: reachable (github.com)"
    else
        print_error "No internet connectivity — cannot download packages or images"
        errors=$((errors + 1))
    fi

    # --- Summary ---
    echo ""
    log "[PREFLIGHT] Completed: $errors errors, $warnings warnings"
    if [[ $errors -gt 0 ]]; then
        print_error "Pre-flight checks failed with $errors error(s)"
        if [[ "$UNATTENDED" == "true" ]]; then
            exit 10
        fi
        echo -e "${YELLOW}  Continue anyway? (NOT recommended) [y/N]: ${NC}"
        read -p "  > " force_continue
        if [[ "${force_continue,,}" != "y" ]]; then
            exit 10
        fi
        print_warning "Continuing despite pre-flight failures"
    elif [[ $warnings -gt 0 ]]; then
        print_warning "Pre-flight completed with $warnings warning(s)"
    else
        print_success "All pre-flight checks passed"
    fi
}

# =============================================================================
# Docker Installation
# =============================================================================

install_docker() {
    print_header "DOCKER INSTALLATION"

    if command -v docker &>/dev/null; then
        local docker_version
        docker_version=$(docker --version | awk '{print $3}' | tr -d ',')
        print_success "Docker is already installed (version $docker_version)"
    else
        print_step "Installing Docker Engine..."

        # Detect OS
        if [[ -f /etc/os-release ]]; then
            # shellcheck disable=SC1091
            source /etc/os-release
            local os_id="$ID"
        else
            print_error "Cannot detect operating system."
            exit 11
        fi

        case "$os_id" in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null 2>&1
                install -m 0755 -d /etc/apt/keyrings
                curl -fsSL "https://download.docker.com/linux/$os_id/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
                chmod a+r /etc/apt/keyrings/docker.gpg
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$os_id $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
                apt-get update -qq
                apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1
                ;;
            centos|rhel|fedora|rocky|almalinux)
                yum install -y -q yum-utils >/dev/null 2>&1
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo >/dev/null 2>&1
                yum install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1
                ;;
            *)
                print_error "Unsupported OS: $os_id. Supported: Ubuntu, Debian, CentOS, RHEL, Fedora, Rocky, AlmaLinux"
                exit 11
                ;;
        esac

        systemctl enable docker --now
        print_success "Docker installed successfully"
    fi

    # Verify Docker Compose plugin
    if ! docker compose version &>/dev/null; then
        print_error "Docker Compose plugin not found. Install docker-compose-plugin."
        exit 21
    fi
    print_success "Docker Compose: $(docker compose version --short)"
}

# =============================================================================
# System Prerequisites
# =============================================================================

install_prerequisites() {
    print_header "INSTALLING PREREQUISITES"
    print_step "Installing system packages..."

    # Detect OS
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        local os_id="$ID"
    else
        os_id="unknown"
    fi

    case "$os_id" in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq curl wget openssl jq netcat-openbsd >/dev/null 2>&1
            ;;
        centos|rhel|fedora|rocky|almalinux)
            yum install -y -q curl wget openssl jq nmap-ncat >/dev/null 2>&1
            ;;
        *)
            print_warning "Unknown OS — attempting to install prerequisites anyway"
            ;;
    esac

    print_success "Prerequisites installed"
}

# =============================================================================
# Collect Configuration (Interactive)
# =============================================================================

collect_configuration() {
    if [[ "$UNATTENDED" == "true" ]]; then
        print_header "CONFIGURATION (UNATTENDED)"
        print_success "Using pre-loaded configuration:"
        print_info "  Instance:    $INSTANCE_NAME"
        print_info "  Kafka:       $KAFKA_BOOTSTRAP_SERVER"
        print_info "  Topics:      $TOPICS"
        print_info "  PG Port:     $POSTGRES_PORT"
        print_info "  Connect:     $CONNECT_PORT"
        print_info "  Group ID:    $CONNECTOR_GROUP_ID"
        print_info "  FreeRADIUS:  $INSTALL_FREERADIUS"
        log "[CONFIG] Unattended mode — config already loaded"
        return 0
    fi

    print_header "EDGE RUNTIME CONFIGURATION"

    echo -e "${CYAN}  This wizard will gather the connection details for your edge runtime.${NC}"
    echo -e "${CYAN}  You'll need information from your central OpenRadius server.${NC}"
    echo ""

    # ─── Instance Name ────────────────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Instance Name${NC}"
    echo -e "  A unique name for this edge site (lowercase, hyphens/underscores allowed)."
    echo -e "  Examples: ${GRAY}branch-office-1, site-baghdad, warehouse-north${NC}"
    echo ""
    while true; do
        echo -e "${CYAN}  Enter instance name: ${NC}"
        read -p "  > " INSTANCE_NAME
        INSTANCE_NAME=$(echo "$INSTANCE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')
        if validate_instance_name "$INSTANCE_NAME"; then
            break
        else
            print_error "Invalid instance name. Use lowercase letters, numbers, hyphens, or underscores (max 63 chars)."
        fi
    done
    print_success "Instance name: $INSTANCE_NAME"

    # Derive paths
    INSTALL_DIR="/opt/openradius-edge/$INSTANCE_NAME"
    LOG_FILE="$INSTALL_DIR/install.log"
    CHECKPOINT_FILE="$INSTALL_DIR/.install-checkpoint"

    # ─── Central Server Connection ────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Central Server — Kafka/Redpanda Connection${NC}"
    echo -e "  The Kafka bootstrap server address from your central OpenRadius deployment."
    echo -e "  Format: ${GRAY}hostname:port${NC} (e.g., ${GRAY}kafka.example.com:9094${NC})"
    echo ""
    while true; do
        echo -e "${CYAN}  Enter Kafka bootstrap server (host:port): ${NC}"
        read -p "  > " KAFKA_BOOTSTRAP_SERVER
        if [[ -n "$KAFKA_BOOTSTRAP_SERVER" ]] && validate_host "${KAFKA_BOOTSTRAP_SERVER%%:*}"; then
            # Default port 9094 if not specified
            if [[ ! "$KAFKA_BOOTSTRAP_SERVER" =~ :[0-9]+$ ]]; then
                KAFKA_BOOTSTRAP_SERVER="${KAFKA_BOOTSTRAP_SERVER}:9094"
                print_info "Using default port 9094: $KAFKA_BOOTSTRAP_SERVER"
            fi
            break
        else
            print_error "Invalid address. Use format: hostname:port (e.g., kafka.example.com:9094)"
        fi
    done
    print_success "Kafka bootstrap: $KAFKA_BOOTSTRAP_SERVER"

    # ─── Kafka SASL Credentials ───────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Kafka SASL/SCRAM Authentication${NC}"
    echo -e "  Credentials for authenticating with the central Kafka broker."
    echo -e "  These are found in: ${GRAY}/opt/openradius/openradius-credentials-*.txt${NC}"
    echo -e "  or in: ${GRAY}/opt/openradius/edge-runtime.env${NC}"
    echo ""

    echo -e "${CYAN}  Enter Kafka SASL username [admin]: ${NC}"
    read -p "  > " KAFKA_SASL_USERNAME
    KAFKA_SASL_USERNAME="${KAFKA_SASL_USERNAME:-admin}"

    while true; do
        echo -e "${CYAN}  Enter Kafka SASL password: ${NC}"
        read -sp "  > " KAFKA_SASL_PASSWORD
        echo ""
        if [[ -n "$KAFKA_SASL_PASSWORD" ]]; then
            break
        else
            print_error "Kafka SASL password is required."
        fi
    done
    print_success "Kafka credentials configured"

    # ─── Topics ───────────────────────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Kafka Topics to Sync${NC}"
    echo -e "  Comma-separated list of topics to replicate to this edge site."
    echo -e "  Format: ${GRAY}server_name.schema.table${NC}"
    echo -e "  Example: ${GRAY}workspace_1.public.RadiusUsers,workspace_1.public.RadiusProfiles${NC}"
    echo ""
    echo -e "  Available default tables:"
    echo -e "    ${GRAY}• RadiusUsers           — User accounts${NC}"
    echo -e "    ${GRAY}• RadiusProfiles         — Service profiles${NC}"
    echo -e "    ${GRAY}• RadiusNasDevices       — NAS devices${NC}"
    echo -e "    ${GRAY}• RadiusIpReservations   — IP reservations${NC}"
    echo -e "    ${GRAY}• radius_ip_pools        — IP pools${NC}"
    echo ""

    echo -e "${CYAN}  Enter Debezium server name / topic prefix [workspace_1]: ${NC}"
    read -p "  > " SERVER_NAME
    SERVER_NAME="${SERVER_NAME:-workspace_1}"

    echo ""
    echo -e "  ${BOLD}Select tables to sync:${NC}"
    echo "  1) All default tables (recommended)"
    echo "  2) RadiusUsers only"
    echo "  3) RadiusUsers + RadiusProfiles"
    echo "  4) Custom (enter topics manually)"
    echo -e "${CYAN}  Choose option [1/2/3/4]: ${NC}"
    read -p "  > " topic_choice

    case "${topic_choice:-1}" in
        1)
            TOPICS="${SERVER_NAME}.public.RadiusUsers,${SERVER_NAME}.public.RadiusProfiles,${SERVER_NAME}.public.RadiusNasDevices,${SERVER_NAME}.public.RadiusIpReservations,${SERVER_NAME}.public.radius_ip_pools"
            ;;
        2)
            TOPICS="${SERVER_NAME}.public.RadiusUsers"
            ;;
        3)
            TOPICS="${SERVER_NAME}.public.RadiusUsers,${SERVER_NAME}.public.RadiusProfiles"
            ;;
        4)
            while true; do
                echo -e "${CYAN}  Enter topics (comma-separated): ${NC}"
                read -p "  > " TOPICS
                if [[ -n "$TOPICS" ]]; then
                    break
                else
                    print_error "At least one topic is required."
                fi
            done
            ;;
        *)
            TOPICS="${SERVER_NAME}.public.RadiusUsers,${SERVER_NAME}.public.RadiusProfiles,${SERVER_NAME}.public.RadiusNasDevices,${SERVER_NAME}.public.RadiusIpReservations,${SERVER_NAME}.public.radius_ip_pools"
            ;;
    esac
    print_success "Topics: $TOPICS"

    # ─── Port Configuration ───────────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Port Configuration${NC}"
    echo -e "  Configure the ports exposed on this edge server."
    echo ""

    echo -e "${CYAN}  PostgreSQL port [5434]: ${NC}"
    read -p "  > " input_pg_port
    POSTGRES_PORT="${input_pg_port:-5434}"
    if ! validate_port "$POSTGRES_PORT"; then
        print_warning "Invalid port, using default: 5434"
        POSTGRES_PORT="5434"
    fi

    echo -e "${CYAN}  Kafka Connect REST port [8084]: ${NC}"
    read -p "  > " input_connect_port
    CONNECT_PORT="${input_connect_port:-8084}"
    if ! validate_port "$CONNECT_PORT"; then
        print_warning "Invalid port, using default: 8084"
        CONNECT_PORT="8084"
    fi

    echo -e "${CYAN}  Connector group ID (unique per edge instance) [2]: ${NC}"
    read -p "  > " input_group_id
    CONNECTOR_GROUP_ID="${input_group_id:-2}"

    print_success "Ports: PostgreSQL=$POSTGRES_PORT, Connect=$CONNECT_PORT, GroupID=$CONNECTOR_GROUP_ID"

    # ─── Edge Site Identity ───────────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Edge Site Identity${NC}"
    echo ""

    echo -e "${CYAN}  Edge Site ID [${INSTANCE_NAME}]: ${NC}"
    read -p "  > " input_site_id
    EDGE_SITE_ID="${input_site_id:-$INSTANCE_NAME}"

    echo -e "${CYAN}  Central API URL (optional, for health reporting): ${NC}"
    echo -e "  ${GRAY}Example: https://api.example.com${NC}"
    read -p "  > " CENTRAL_API_URL

    print_success "Edge Site ID: $EDGE_SITE_ID"

    # ─── Optional Components ──────────────────────────────────────────────
    print_divider
    echo -e "${BOLD}  Optional Components${NC}"
    echo ""

    echo -e "${CYAN}  Install FreeRADIUS for local RADIUS authentication? [y/N]: ${NC}"
    read -p "  > " INSTALL_FREERADIUS
    INSTALL_FREERADIUS="${INSTALL_FREERADIUS,,}"
    INSTALL_FREERADIUS="${INSTALL_FREERADIUS:-n}"

    if [[ "$INSTALL_FREERADIUS" == "y" ]]; then
        echo -e "${CYAN}  Enter NAS shared secret (min 8 chars) [auto-generate]: ${NC}"
        read -sp "  > " input_nas_secret
        echo ""
        if [[ -n "$input_nas_secret" ]] && [[ ${#input_nas_secret} -ge 8 ]]; then
            NAS_SECRET="$input_nas_secret"
        else
            NAS_SECRET=$(generate_password 16)
            print_info "NAS secret auto-generated"
        fi
    fi

    echo ""
    echo -e "${CYAN}  Install RadiusSyncService (Docker monitoring & SignalR bridge)? [Y/n]: ${NC}"
    echo -e "  ${GRAY}Enables real-time server resource monitoring, Docker management,${NC}"
    echo -e "  ${GRAY}and bi-directional communication with the central OpenRadius panel.${NC}"
    read -p "  > " INSTALL_SYNC_SERVICE
    INSTALL_SYNC_SERVICE="${INSTALL_SYNC_SERVICE,,}"
    INSTALL_SYNC_SERVICE="${INSTALL_SYNC_SERVICE:-y}"

    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        echo -e "${CYAN}  RadiusSyncService HTTP port [5242]: ${NC}"
        read -p "  > " input_sync_port
        SYNC_SERVICE_PORT="${input_sync_port:-5242}"
        if ! validate_port "$SYNC_SERVICE_PORT"; then
            print_warning "Invalid port, using default: 5242"
            SYNC_SERVICE_PORT="5242"
        fi

        echo -e "${CYAN}  Central OpenRadius SignalR Hub URL: ${NC}"
        echo -e "  ${GRAY}Example: https://api.example.com/hubs/microservices${NC}"
        if [[ -n "$CENTRAL_API_URL" ]]; then
            local default_hub="${CENTRAL_API_URL%/}/hubs/microservices"
            echo -e "  ${GRAY}Default: ${default_hub}${NC}"
            read -p "  > " input_hub_url
            SIGNALR_HUB_URL="${input_hub_url:-$default_hub}"
        else
            read -p "  > " SIGNALR_HUB_URL
        fi

        if [[ -z "$SIGNALR_HUB_URL" ]]; then
            print_warning "SignalR Hub URL not set. RadiusSyncService will run but cannot connect to central panel."
            SIGNALR_HUB_URL="http://localhost:5000/hubs/microservices"
        fi

        print_success "RadiusSyncService: port=$SYNC_SERVICE_PORT, hub=$SIGNALR_HUB_URL"
    fi

    echo -e "${CYAN}  Enable Prometheus monitoring endpoint? [y/N]: ${NC}"
    read -p "  > " ENABLE_MONITORING
    ENABLE_MONITORING="${ENABLE_MONITORING,,}"
    ENABLE_MONITORING="${ENABLE_MONITORING:-n}"

    # ─── Generate secrets ─────────────────────────────────────────────────
    POSTGRES_PASSWORD=$(generate_password 32)
    POSTGRES_DB="${INSTANCE_NAME//-/_}_db"

    # ─── Configuration Summary ────────────────────────────────────────────
    print_divider
    print_header "CONFIGURATION SUMMARY"

    echo -e "  ${BOLD}Instance:${NC}          $INSTANCE_NAME"
    echo -e "  ${BOLD}Install Dir:${NC}       $INSTALL_DIR"
    echo -e "  ${BOLD}Kafka Bootstrap:${NC}   $KAFKA_BOOTSTRAP_SERVER"
    echo -e "  ${BOLD}SASL Username:${NC}     $KAFKA_SASL_USERNAME"
    echo -e "  ${BOLD}Topics:${NC}"
    IFS=',' read -ra topic_arr <<< "$TOPICS"
    for t in "${topic_arr[@]}"; do
        echo -e "    ${GRAY}• $(echo "$t" | xargs)${NC}"
    done
    echo -e "  ${BOLD}PostgreSQL Port:${NC}   $POSTGRES_PORT"
    echo -e "  ${BOLD}Connect Port:${NC}      $CONNECT_PORT"
    echo -e "  ${BOLD}Group ID:${NC}          $CONNECTOR_GROUP_ID"
    echo -e "  ${BOLD}Edge Site ID:${NC}      $EDGE_SITE_ID"
    echo -e "  ${BOLD}FreeRADIUS:${NC}        $INSTALL_FREERADIUS"
    echo -e "  ${BOLD}SyncService:${NC}       $INSTALL_SYNC_SERVICE"
    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        echo -e "  ${BOLD}SyncService Port:${NC}  $SYNC_SERVICE_PORT"
        echo -e "  ${BOLD}SignalR Hub URL:${NC}   $SIGNALR_HUB_URL"
    fi
    echo -e "  ${BOLD}Monitoring:${NC}        $ENABLE_MONITORING"
    echo ""

    echo -e "${YELLOW}  Proceed with installation? [Y/n]: ${NC}"
    read -p "  > " confirm
    confirm="${confirm,,}"
    if [[ "$confirm" == "n" ]]; then
        print_error "Installation cancelled by user."
        exit 0
    fi
}

# =============================================================================
# Verify Kafka Connectivity
# =============================================================================

verify_kafka_connectivity() {
    print_header "VERIFYING KAFKA CONNECTIVITY"

    local kafka_host="${KAFKA_BOOTSTRAP_SERVER%%:*}"
    local kafka_port="${KAFKA_BOOTSTRAP_SERVER##*:}"
    kafka_port="${kafka_port:-9094}"

    print_step "Testing TCP connectivity to $kafka_host:$kafka_port..."

    local retries=0
    local max_retries=3
    local connected=false

    while [[ $retries -lt $max_retries ]]; do
        if timeout 10 bash -c "echo > /dev/tcp/$kafka_host/$kafka_port" 2>/dev/null; then
            connected=true
            break
        fi
        retries=$((retries + 1))
        if [[ $retries -lt $max_retries ]]; then
            print_warning "Connection attempt $retries failed. Retrying in 5s..."
            sleep 5
        fi
    done

    if [[ "$connected" == "true" ]]; then
        print_success "Kafka broker is reachable at $kafka_host:$kafka_port"
    else
        print_warning "Cannot reach Kafka broker at $kafka_host:$kafka_port"
        print_info "This may be expected if:"
        print_info "  • The Kafka broker is not yet running"
        print_info "  • Firewall rules haven't been applied yet"
        print_info "  • DNS hasn't propagated yet"
        echo ""
        if [[ "$UNATTENDED" != "true" ]]; then
            echo -e "${YELLOW}  Continue anyway? The edge runtime will retry on startup. [Y/n]: ${NC}"
            read -p "  > " continue_anyway
            if [[ "${continue_anyway,,}" == "n" ]]; then
                exit 40
            fi
        fi
        print_warning "Proceeding without Kafka verification — connector will retry on startup"
    fi
}

# =============================================================================
# Generate Configuration Files
# =============================================================================

generate_configs() {
    print_header "GENERATING CONFIGURATION FILES"

    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    print_success "Install directory: $INSTALL_DIR"

    # ─── Dockerfile ───────────────────────────────────────────────────────
    print_step "Creating Dockerfile..."

    cat > "$INSTALL_DIR/Dockerfile" << DOCKERFILE_EOF
FROM debezium/connect:${DEBEZIUM_CONNECT_VERSION}

# Install JDBC Sink Connector plugin for database synchronization
USER root
RUN cd /kafka/connect && \\
    curl -sL https://repo1.maven.org/maven2/io/debezium/debezium-connector-jdbc/${DEBEZIUM_CONNECT_VERSION}/debezium-connector-jdbc-${DEBEZIUM_CONNECT_VERSION}-plugin.tar.gz | tar xz && \\
    chown -R kafka:kafka /kafka/connect

USER kafka
DOCKERFILE_EOF
    print_success "Dockerfile created"

    # ─── RadiusSyncService Dockerfile ─────────────────────────────────────
    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        print_step "Creating RadiusSyncService Dockerfile..."

        mkdir -p "$INSTALL_DIR/syncservice"

        cat > "$INSTALL_DIR/syncservice/Dockerfile" << 'SYNCSERVICE_DOCKERFILE_EOF'
# ==========================================================================
# OpenRadius RadiusSyncService — Multi-Stage Docker Build
# ==========================================================================
# Enterprise-grade .NET microservice for real-time SignalR monitoring,
# Docker container management, and edge-to-central sync orchestration.
# ==========================================================================

FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy project file and restore dependencies (layer caching)
COPY RadiusSyncService.csproj ./
RUN dotnet restore

# Copy remaining source and publish release build
COPY . ./
RUN dotnet publish -c Release -o /app/publish --no-restore

# ==========================================================================
# Runtime stage — minimal ASP.NET image
# ==========================================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r openradius && useradd -r -g openradius -m openradius

COPY --from=build /app/publish .

# Create config directory for machine identity persistence
RUN mkdir -p /app/.config/OpenRadius && \
    chown -R openradius:openradius /app

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Note: Running as root is required for Docker socket access.
# In production, consider using Docker socket proxy for least-privilege.
USER root

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD curl -sf http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "RadiusSyncService.dll"]
SYNCSERVICE_DOCKERFILE_EOF

        # Copy RadiusSyncService source files into the build context
        print_step "Preparing RadiusSyncService source files..."

        # Resolve source path relative to the installer script's location
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        local syncservice_source=""

        # Search common locations for the RadiusSyncService source
        local search_paths=(
            "${script_dir}/microservices/RadiusSyncService"
            "${script_dir}/../microservices/RadiusSyncService"
            "/opt/openradius/microservices/RadiusSyncService"
        )

        for search_path in "${search_paths[@]}"; do
            if [[ -d "$search_path" ]] && [[ -f "$search_path/RadiusSyncService.csproj" ]]; then
                syncservice_source="$search_path"
                break
            fi
        done

        if [[ -n "$syncservice_source" ]]; then
            # Copy source files (excluding bin/obj build artifacts)
            rsync -a --exclude='bin/' --exclude='obj/' "$syncservice_source/" "$INSTALL_DIR/syncservice/" 2>/dev/null || \
            cp -r "$syncservice_source"/* "$INSTALL_DIR/syncservice/" 2>/dev/null || true
            # Clean build artifacts if rsync wasn't available
            rm -rf "$INSTALL_DIR/syncservice/bin" "$INSTALL_DIR/syncservice/obj" 2>/dev/null || true
            print_success "RadiusSyncService source files prepared from: $syncservice_source"
        else
            print_warning "RadiusSyncService source not found in standard locations."
            print_info "Searched: ${search_paths[*]}"
            print_info "Place the source in: $INSTALL_DIR/syncservice/"
            print_info "Required file: RadiusSyncService.csproj"
        fi

        print_success "RadiusSyncService Dockerfile created"
    fi

    # ─── init.sql ─────────────────────────────────────────────────────────
    print_step "Creating database schema..."

    cat > "$INSTALL_DIR/init.sql" << 'SQL_EOF'
-- ==========================================================================
-- OpenRadius Edge Runtime — Database Schema
-- ==========================================================================
-- These tables mirror the central database and are populated by the
-- Debezium JDBC Sink Connector from Kafka CDC events.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public."RadiusUsers"
(
    "Id"                   integer generated by default as identity
        constraint "PK_RadiusUsers" primary key,
    "ExternalId"           integer                  not null,
    "Username"             text,
    "Firstname"            text,
    "Lastname"             text,
    "City"                 text,
    "Phone"                text,
    "ProfileId"            integer,
    "Balance"              numeric                  not null,
    "LoanBalance"          numeric                  not null,
    "Expiration"           timestamp with time zone,
    "LastOnline"           timestamp with time zone,
    "ParentId"             integer,
    "Email"                text,
    "StaticIp"             text,
    "Enabled"              boolean                  not null,
    "Company"              text,
    "Notes"                text,
    "SimultaneousSessions" integer                  not null,
    "Address"              text,
    "ContractId"           text,
    "NationalId"           text,
    "MikrotikIpv6Prefix"   text,
    "GroupId"              integer,
    "GpsLat"               text,
    "GpsLng"               text,
    "Street"               text,
    "SiteId"               integer,
    "PinTries"             integer                  not null,
    "RemainingDays"        integer                  not null,
    "OnlineStatus"         integer                  not null,
    "UsedTraffic"          bigint                   not null,
    "AvailableTraffic"     bigint                   not null,
    "ParentUsername"       text,
    "DebtDays"             integer                  not null,
    "IsDeleted"            boolean                  not null,
    "DeletedAt"            timestamp with time zone,
    "WorkspaceId"          integer                  not null,
    "CreatedAt"            timestamp with time zone not null,
    "UpdatedAt"            timestamp with time zone not null,
    "LastSyncedAt"         timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_radiususers_username ON public."RadiusUsers"("Username");
CREATE INDEX IF NOT EXISTS idx_radiususers_externalid ON public."RadiusUsers"("ExternalId");
CREATE INDEX IF NOT EXISTS idx_radiususers_profileid ON public."RadiusUsers"("ProfileId");
CREATE INDEX IF NOT EXISTS idx_radiususers_enabled ON public."RadiusUsers"("Enabled");

CREATE TABLE IF NOT EXISTS public."RadiusProfiles"
(
    "Id"              integer generated by default as identity
        constraint "PK_RadiusProfiles" primary key,
    "Name"            text not null,
    "DownloadSpeed"   bigint not null default 0,
    "UploadSpeed"     bigint not null default 0,
    "DailyTraffic"    bigint not null default 0,
    "MonthlyTraffic"  bigint not null default 0,
    "TotalTraffic"    bigint not null default 0,
    "Duration"        integer not null default 0,
    "Price"           numeric not null default 0,
    "IsDeleted"       boolean not null default false,
    "DeletedAt"       timestamp with time zone,
    "WorkspaceId"     integer not null,
    "CreatedAt"       timestamp with time zone not null,
    "UpdatedAt"       timestamp with time zone not null
);

CREATE INDEX IF NOT EXISTS idx_radiusprofiles_name ON public."RadiusProfiles"("Name");

CREATE TABLE IF NOT EXISTS public."RadiusNasDevices"
(
    "Id"              integer generated by default as identity
        constraint "PK_RadiusNasDevices" primary key,
    "NasName"         text,
    "ShortName"       text,
    "Type"            text,
    "Secret"          text,
    "Ports"           integer,
    "Server"          text,
    "Community"       text,
    "Description"     text,
    "IpAddress"       text,
    "IsDeleted"       boolean not null default false,
    "DeletedAt"       timestamp with time zone,
    "WorkspaceId"     integer not null,
    "CreatedAt"       timestamp with time zone not null,
    "UpdatedAt"       timestamp with time zone not null
);

CREATE INDEX IF NOT EXISTS idx_radiusnasdevices_ipaddress ON public."RadiusNasDevices"("IpAddress");

CREATE TABLE IF NOT EXISTS public."RadiusIpReservations"
(
    "Id"              integer generated by default as identity
        constraint "PK_RadiusIpReservations" primary key,
    "IpAddress"       text not null,
    "Username"        text,
    "PoolName"        text,
    "Description"     text,
    "IsActive"        boolean not null default true,
    "IsDeleted"       boolean not null default false,
    "DeletedAt"       timestamp with time zone,
    "WorkspaceId"     integer not null,
    "CreatedAt"       timestamp with time zone not null,
    "UpdatedAt"       timestamp with time zone not null
);

CREATE INDEX IF NOT EXISTS idx_radiusipreservations_ip ON public."RadiusIpReservations"("IpAddress");
CREATE INDEX IF NOT EXISTS idx_radiusipreservations_username ON public."RadiusIpReservations"("Username");

CREATE TABLE IF NOT EXISTS public."radius_ip_pools"
(
    id                 integer generated by default as identity primary key,
    pool_name          text not null,
    framedipaddress    text not null,
    nasipaddress       text,
    calledstationid    text,
    callingstationid   text,
    expiry_time        timestamp with time zone,
    username           text,
    pool_key           text
);

CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_poolname ON public.radius_ip_pools(pool_name);
CREATE INDEX IF NOT EXISTS idx_radius_ip_pools_framedip ON public.radius_ip_pools(framedipaddress);

-- Audit/sync metadata table
CREATE TABLE IF NOT EXISTS public."_edge_sync_status"
(
    "Id"              serial primary key,
    "TopicName"       text not null unique,
    "LastOffset"      bigint default 0,
    "LastSyncedAt"    timestamp with time zone,
    "RecordCount"     bigint default 0,
    "Status"          text default 'active'
);
SQL_EOF
    print_success "Database schema created"

    # ─── docker-compose.yml ───────────────────────────────────────────────
    print_step "Creating Docker Compose configuration..."

    local service_pg="postgres_${INSTANCE_NAME//-/_}"
    local service_connect="connect_${INSTANCE_NAME//-/_}"

    cat > "$INSTALL_DIR/docker-compose.yml" << COMPOSE_EOF
# ==========================================================================
# OpenRadius Edge Runtime — Docker Compose
# Instance: ${INSTANCE_NAME}
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# ==========================================================================

services:
  ${service_pg}:
    image: postgres:${POSTGRES_VERSION}
    container_name: ${service_pg}
    command: postgres -c wal_level=logical -c max_connections=200 -c shared_buffers=256MB
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - postgres_data:/var/lib/postgresql/data
    networks:
      - edge-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  ${service_connect}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${service_connect}
    platform: linux/amd64
    depends_on:
      ${service_pg}:
        condition: service_healthy
    environment:
      BOOTSTRAP_SERVERS: ${KAFKA_BOOTSTRAP_SERVER}
      GROUP_ID: ${CONNECTOR_GROUP_ID}
      CONFIG_STORAGE_TOPIC: connect_configs_${INSTANCE_NAME//-/_}
      OFFSET_STORAGE_TOPIC: connect_offsets_${INSTANCE_NAME//-/_}
      STATUS_STORAGE_TOPIC: connect_status_${INSTANCE_NAME//-/_}
      REST_ADVERTISED_HOST_NAME: ${service_connect}
      CONNECT_KEY_CONVERTER_SCHEMAS_ENABLE: "true"
      CONNECT_VALUE_CONVERTER_SCHEMAS_ENABLE: "true"
      CONNECT_OFFSET_FLUSH_INTERVAL_MS: "10000"
      CONNECT_OFFSET_FLUSH_TIMEOUT_MS: "5000"
      CONNECT_STATUS_STORAGE_REPLICATION_FACTOR: "1"
      CONNECT_CONFIG_STORAGE_REPLICATION_FACTOR: "1"
      CONNECT_OFFSET_STORAGE_REPLICATION_FACTOR: "1"
      CONNECT_SASL_MECHANISM: "SCRAM-SHA-256"
      CONNECT_SECURITY_PROTOCOL: "SASL_PLAINTEXT"
      CONNECT_SASL_JAAS_CONFIG: 'org.apache.kafka.common.security.scram.ScramLoginModule required username="${KAFKA_SASL_USERNAME}" password="${KAFKA_SASL_PASSWORD}";'
      CONNECT_PRODUCER_SASL_MECHANISM: "SCRAM-SHA-256"
      CONNECT_PRODUCER_SECURITY_PROTOCOL: "SASL_PLAINTEXT"
      CONNECT_PRODUCER_SASL_JAAS_CONFIG: 'org.apache.kafka.common.security.scram.ScramLoginModule required username="${KAFKA_SASL_USERNAME}" password="${KAFKA_SASL_PASSWORD}";'
      CONNECT_CONSUMER_SASL_MECHANISM: "SCRAM-SHA-256"
      CONNECT_CONSUMER_SECURITY_PROTOCOL: "SASL_PLAINTEXT"
      CONNECT_CONSUMER_SASL_JAAS_CONFIG: 'org.apache.kafka.common.security.scram.ScramLoginModule required username="${KAFKA_SASL_USERNAME}" password="${KAFKA_SASL_PASSWORD}";'
      KAFKA_HEAP_OPTS: "-Xms512M -Xmx2G"
    ports:
      - "${CONNECT_PORT}:8083"
    networks:
      - edge-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8083/"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 90s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G
        reservations:
          cpus: '0.5'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
COMPOSE_EOF

    # Append FreeRADIUS if requested
    if [[ "$INSTALL_FREERADIUS" == "y" ]]; then
        cat >> "$INSTALL_DIR/docker-compose.yml" << FREERADIUS_EOF

  freeradius_${INSTANCE_NAME//-/_}:
    image: freeradius/freeradius-server:3.2.6
    container_name: freeradius_${INSTANCE_NAME//-/_}
    depends_on:
      ${service_pg}:
        condition: service_healthy
    environment:
      POSTGRES_HOST: ${service_pg}
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "1812:1812/udp"
      - "1813:1813/udp"
    networks:
      - edge-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
FREERADIUS_EOF
        print_success "FreeRADIUS service added"
    fi

    # Append RadiusSyncService if requested
    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        cat >> "$INSTALL_DIR/docker-compose.yml" << SYNCSERVICE_EOF

  syncservice_${INSTANCE_NAME//-/_}:
    build:
      context: ./syncservice
      dockerfile: Dockerfile
    container_name: syncservice_${INSTANCE_NAME//-/_}
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: http://+:8080
      SignalR__HubUrl: ${SIGNALR_HUB_URL}
      SignalR__ReconnectDelaySeconds: 5
      SignalR__HeartbeatIntervalSeconds: 30
    ports:
      - "${SYNC_SERVICE_PORT}:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - syncservice_data:/app/.config/OpenRadius
    networks:
      - edge-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
SYNCSERVICE_EOF
        print_success "RadiusSyncService added to Docker Compose"
    fi

    # Networks and volumes
    cat >> "$INSTALL_DIR/docker-compose.yml" << VOLUMES_EOF

networks:
  edge-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
VOLUMES_EOF

    # Append syncservice volume if installed
    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        cat >> "$INSTALL_DIR/docker-compose.yml" << SYNC_VOL_EOF
  syncservice_data:
    driver: local
SYNC_VOL_EOF
    fi

    print_success "Docker Compose configuration created"

    # ─── JDBC Sink Connector Configuration ────────────────────────────────
    print_step "Creating JDBC Sink Connector configuration..."

    # Build table name format based on topics
    local primary_table="public.RadiusUsers"
    if [[ "$TOPICS" == *"RadiusProfiles"* ]] && [[ "$TOPICS" != *","* ]]; then
        primary_table="public.RadiusProfiles"
    fi

    cat > "$INSTALL_DIR/jdbc-sink-connector.json" << CONNECTOR_EOF
{
  "name": "jdbc-sink-${INSTANCE_NAME}",
  "config": {
    "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector",
    "tasks.max": "1",
    "topics": "${TOPICS}",
    "connection.url": "jdbc:postgresql://${service_pg}:5432/${POSTGRES_DB}",
    "connection.username": "${POSTGRES_USER}",
    "connection.password": "${POSTGRES_PASSWORD}",
    "insert.mode": "upsert",
    "delete.enabled": "true",
    "primary.key.mode": "record_key",
    "primary.key.fields": "Id",
    "auto.create": "false",
    "auto.evolve": "true",
    "schema.evolution": "basic",
    "quote.identifiers": "true",
    "table.name.format": "${primary_table}",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "true",
    "value.converter.schemas.enable": "true",
    "errors.tolerance": "all",
    "errors.log.enable": "true",
    "errors.log.include.messages": "true",
    "errors.deadletterqueue.topic.name": "dlq-jdbc-sink-${INSTANCE_NAME}",
    "errors.deadletterqueue.topic.replication.factor": "1",
    "errors.deadletterqueue.context.headers.enable": "true"
  }
}
CONNECTOR_EOF
    print_success "JDBC Sink Connector config created"

    # ─── Save .edge-runtime.env ───────────────────────────────────────────
    print_step "Saving configuration metadata..."

    cat > "$INSTALL_DIR/.edge-runtime.env" << ENV_EOF
# ==========================================================================
# OpenRadius Edge Runtime Configuration
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Instance: ${INSTANCE_NAME}
# ==========================================================================
# WARNING: This file contains sensitive credentials. Keep it secure.
# ==========================================================================

INSTANCE_NAME=${INSTANCE_NAME}
EDGE_SITE_ID=${EDGE_SITE_ID}
INSTALLER_VERSION=${EDGE_RUNTIME_VERSION}

# PostgreSQL
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_PORT=${POSTGRES_PORT}

# Kafka
KAFKA_BOOTSTRAP_SERVER=${KAFKA_BOOTSTRAP_SERVER}
KAFKA_SASL_USERNAME=${KAFKA_SASL_USERNAME}
KAFKA_SASL_PASSWORD=${KAFKA_SASL_PASSWORD}
TOPICS=${TOPICS}
SERVER_NAME=${SERVER_NAME}
CONNECTOR_GROUP_ID=${CONNECTOR_GROUP_ID}
CONNECT_PORT=${CONNECT_PORT}

# Optional
INSTALL_FREERADIUS=${INSTALL_FREERADIUS}
NAS_SECRET=${NAS_SECRET}
CENTRAL_API_URL=${CENTRAL_API_URL}
ENABLE_MONITORING=${ENABLE_MONITORING}

# RadiusSyncService
INSTALL_SYNC_SERVICE=${INSTALL_SYNC_SERVICE}
SYNC_SERVICE_PORT=${SYNC_SERVICE_PORT}
SIGNALR_HUB_URL=${SIGNALR_HUB_URL}
ENV_EOF

    chmod 600 "$INSTALL_DIR/.edge-runtime.env"
    print_success "Configuration saved to .edge-runtime.env (chmod 600)"
}

# =============================================================================
# Generate Management Scripts
# =============================================================================

generate_management_scripts() {
    print_header "GENERATING MANAGEMENT SCRIPTS"

    local service_pg="postgres_${INSTANCE_NAME//-/_}"
    local service_connect="connect_${INSTANCE_NAME//-/_}"

    # ─── register-connector.sh ────────────────────────────────────────────
    print_step "Creating connector registration script..."

    cat > "$INSTALL_DIR/register-connector.sh" << 'REGISTER_EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/jdbc-sink-connector.json"
CONNECT_URL="http://localhost:__CONNECT_PORT__"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Waiting for Kafka Connect to be ready...${NC}"
RETRIES=0
MAX_RETRIES=60
until curl -sf "$CONNECT_URL/" > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        echo -e "${RED}ERROR: Kafka Connect did not become ready after $MAX_RETRIES attempts.${NC}"
        exit 1
    fi
    echo "  Attempt $RETRIES/$MAX_RETRIES — waiting 5s..."
    sleep 5
done

echo -e "${GREEN}Kafka Connect is ready!${NC}"

CONNECTOR_NAME=$(jq -r '.name' "$CONFIG_FILE")

if curl -sf "$CONNECT_URL/connectors/$CONNECTOR_NAME" > /dev/null 2>&1; then
    echo "Connector '$CONNECTOR_NAME' already exists. Updating..."
    curl -sf -X PUT "$CONNECT_URL/connectors/$CONNECTOR_NAME/config" \
        -H "Content-Type: application/json" \
        -d "$(jq '.config' "$CONFIG_FILE")" | jq .
else
    echo "Registering connector '$CONNECTOR_NAME'..."
    curl -sf -X POST "$CONNECT_URL/connectors" \
        -H "Content-Type: application/json" \
        -d @"$CONFIG_FILE" | jq .
fi

echo ""
echo "Checking connector status..."
sleep 5
curl -sf "$CONNECT_URL/connectors/$CONNECTOR_NAME/status" | jq .
echo -e "${GREEN}Connector registration complete!${NC}"
REGISTER_EOF

    sed -i "s/__CONNECT_PORT__/${CONNECT_PORT}/g" "$INSTALL_DIR/register-connector.sh"
    chmod +x "$INSTALL_DIR/register-connector.sh"
    print_success "register-connector.sh created"

    # ─── start.sh ─────────────────────────────────────────────────────────
    print_step "Creating start script..."

    cat > "$INSTALL_DIR/start.sh" << 'START_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Starting OpenRadius Edge Runtime..."
docker compose up -d --build

echo "Waiting for services to initialize..."
sleep 30

echo "Registering connector..."
./register-connector.sh

echo ""
echo "Edge Runtime is running!"
echo "  PostgreSQL : localhost:__PG_PORT__"
echo "  Connect API: http://localhost:__CONNECT_PORT__"
if [ -d "./syncservice" ]; then
    echo "  SyncService: http://localhost:__SYNC_SERVICE_PORT__"
fi
START_EOF

    sed -i "s/__PG_PORT__/${POSTGRES_PORT}/g" "$INSTALL_DIR/start.sh"
    sed -i "s/__CONNECT_PORT__/${CONNECT_PORT}/g" "$INSTALL_DIR/start.sh"
    sed -i "s/__SYNC_SERVICE_PORT__/${SYNC_SERVICE_PORT}/g" "$INSTALL_DIR/start.sh"
    chmod +x "$INSTALL_DIR/start.sh"
    print_success "start.sh created"

    # ─── stop.sh ──────────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/stop.sh" << 'STOP_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
echo "Stopping OpenRadius Edge Runtime..."
docker compose down
echo "Edge Runtime stopped."
STOP_EOF
    chmod +x "$INSTALL_DIR/stop.sh"
    print_success "stop.sh created"

    # ─── restart.sh ───────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/restart.sh" << 'RESTART_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
echo "Restarting OpenRadius Edge Runtime..."
docker compose down
docker compose up -d --build
sleep 30
./register-connector.sh
echo "Edge Runtime restarted."
RESTART_EOF
    chmod +x "$INSTALL_DIR/restart.sh"
    print_success "restart.sh created"

    # ─── status.sh ────────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/status.sh" << 'STATUS_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}=== OpenRadius Edge Runtime Status ===${NC}"
echo ""

echo -e "${CYAN}Docker Containers:${NC}"
docker compose ps
echo ""

echo -e "${CYAN}Connector Status:${NC}"
CONNECTORS=$(curl -sf http://localhost:__CONNECT_PORT__/connectors 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$CONNECTORS" | jq -r '.[]' 2>/dev/null | while read -r name; do
        STATUS=$(curl -sf "http://localhost:__CONNECT_PORT__/connectors/$name/status" | jq -r '.connector.state' 2>/dev/null)
        if [ "$STATUS" = "RUNNING" ]; then
            echo -e "  ${GREEN}● $name: $STATUS${NC}"
        else
            echo -e "  ${RED}● $name: $STATUS${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}Connect API not reachable.${NC}"
fi

echo ""
echo -e "${CYAN}Database:${NC}"
docker compose exec -T __PG_SERVICE__ psql -U __PG_USER__ -d __PG_DB__ -c "SELECT 'RadiusUsers' as table_name, COUNT(*) as rows FROM public.\"RadiusUsers\" UNION ALL SELECT 'RadiusProfiles', COUNT(*) FROM public.\"RadiusProfiles\" UNION ALL SELECT 'RadiusNasDevices', COUNT(*) FROM public.\"RadiusNasDevices\";" 2>/dev/null || echo -e "  ${YELLOW}Cannot query database.${NC}"

echo ""
echo -e "${CYAN}Resource Usage:${NC}"
docker compose stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true

# RadiusSyncService Status
if curl -sf "http://localhost:__SYNC_SERVICE_PORT__/health" > /dev/null 2>&1; then
    echo ""
    echo -e "${CYAN}RadiusSyncService:${NC}"
    SYNC_STATUS=$(curl -sf "http://localhost:__SYNC_SERVICE_PORT__/status" 2>/dev/null)
    if [ $? -eq 0 ]; then
        SIGNALR_CONNECTED=$(echo "$SYNC_STATUS" | jq -r '.signalRConnected' 2>/dev/null || echo "unknown")
        MACHINE_ID=$(echo "$SYNC_STATUS" | jq -r '.machineId' 2>/dev/null || echo "unknown")
        UPTIME=$(echo "$SYNC_STATUS" | jq -r '.uptime' 2>/dev/null || echo "unknown")
        if [ "$SIGNALR_CONNECTED" = "true" ]; then
            echo -e "  ${GREEN}● SignalR: Connected${NC}"
        else
            echo -e "  ${RED}● SignalR: Disconnected${NC}"
        fi
        echo -e "  Machine ID: $MACHINE_ID"
        echo -e "  Uptime:     $UPTIME"
    fi
fi
STATUS_EOF

    sed -i "s/__CONNECT_PORT__/${CONNECT_PORT}/g" "$INSTALL_DIR/status.sh"
    sed -i "s/__PG_SERVICE__/${service_pg}/g" "$INSTALL_DIR/status.sh"
    sed -i "s/__PG_USER__/${POSTGRES_USER}/g" "$INSTALL_DIR/status.sh"
    sed -i "s/__PG_DB__/${POSTGRES_DB}/g" "$INSTALL_DIR/status.sh"
    sed -i "s/__SYNC_SERVICE_PORT__/${SYNC_SERVICE_PORT}/g" "$INSTALL_DIR/status.sh"
    chmod +x "$INSTALL_DIR/status.sh"
    print_success "status.sh created"

    # ─── backup.sh ────────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/backup.sh" << 'BACKUP_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."
docker compose exec -T __PG_SERVICE__ pg_dump -U __PG_USER__ -d __PG_DB__ --format=custom > "$BACKUP_DIR/edge_backup_${TIMESTAMP}.dump"

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/edge_backup_*.dump 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true

BACKUP_SIZE=$(du -h "$BACKUP_DIR/edge_backup_${TIMESTAMP}.dump" | cut -f1)
echo "Backup complete: $BACKUP_DIR/edge_backup_${TIMESTAMP}.dump ($BACKUP_SIZE)"
BACKUP_EOF

    sed -i "s/__PG_SERVICE__/${service_pg}/g" "$INSTALL_DIR/backup.sh"
    sed -i "s/__PG_USER__/${POSTGRES_USER}/g" "$INSTALL_DIR/backup.sh"
    sed -i "s/__PG_DB__/${POSTGRES_DB}/g" "$INSTALL_DIR/backup.sh"
    chmod +x "$INSTALL_DIR/backup.sh"
    print_success "backup.sh created"

    # ─── logs.sh ──────────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/logs.sh" << 'LOGS_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

SERVICE="${1:-}"
LINES="${2:-100}"

if [ -z "$SERVICE" ]; then
    echo "Usage: ./logs.sh [service] [lines]"
    echo "  Services: postgres, connect, freeradius, syncservice, all"
    echo "  Example:  ./logs.sh connect 200"
    echo ""
    echo "Showing last $LINES lines for all services:"
    docker compose logs --tail="$LINES"
else
    case "$SERVICE" in
        all)    docker compose logs --tail="$LINES" -f ;;
        *)      docker compose logs "$SERVICE" --tail="$LINES" -f ;;
    esac
fi
LOGS_EOF
    chmod +x "$INSTALL_DIR/logs.sh"
    print_success "logs.sh created"

    # ─── uninstall.sh ─────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/uninstall.sh" << 'UNINSTALL_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  WARNING: OpenRadius Edge Runtime Uninstallation            ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "This will:"
echo "  1. Stop all edge runtime containers"
echo "  2. Remove Docker volumes (ALL DATABASE DATA)"
echo "  3. Remove Docker images"
echo ""
echo -e "${YELLOW}The install directory will be preserved for reference.${NC}"
echo ""

read -p "Type 'yes' to confirm uninstallation: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Creating final backup before uninstall..."
./backup.sh 2>/dev/null || echo -e "${YELLOW}Backup skipped (database may not be accessible).${NC}"

echo "Stopping and removing containers + volumes..."
docker compose down -v --remove-orphans

echo "Removing Docker images..."
docker compose config --images 2>/dev/null | xargs -r docker rmi 2>/dev/null || true

echo ""
echo -e "${GREEN}Edge Runtime has been removed.${NC}"
echo "Install directory preserved at: $(pwd)"
echo "Backups (if any): $(pwd)/backups/"
UNINSTALL_EOF
    chmod +x "$INSTALL_DIR/uninstall.sh"
    print_success "uninstall.sh created"

    # ─── update.sh ────────────────────────────────────────────────────────
    cat > "$INSTALL_DIR/update.sh" << 'UPDATE_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}OpenRadius Edge Runtime — Update${NC}"
echo ""

# Backup first
echo "Creating pre-update backup..."
./backup.sh

echo "Pulling latest images..."
docker compose pull 2>/dev/null || true
docker compose build --pull

echo "Restarting with new images..."
docker compose down
docker compose up -d

echo "Waiting for services..."
sleep 30
./register-connector.sh

echo ""
echo -e "${GREEN}Update complete!${NC}"
docker compose ps
UPDATE_EOF
    chmod +x "$INSTALL_DIR/update.sh"
    print_success "update.sh created"

    print_success "All management scripts generated"
}

# =============================================================================
# Build Docker Images
# =============================================================================

build_images() {
    print_header "BUILDING DOCKER IMAGES"

    cd "$INSTALL_DIR"

    print_step "Building Debezium Connect image with JDBC Sink plugin..."
    local max_retries=3
    local attempt=1

    while [[ $attempt -le $max_retries ]]; do
        if docker compose build --no-cache 2>&1; then
            print_success "Docker images built successfully"
            return 0
        fi

        if [[ $attempt -lt $max_retries ]]; then
            print_warning "Build failed (attempt $attempt/$max_retries). Retrying in 10s..."
            sleep 10
        fi
        attempt=$((attempt + 1))
    done

    print_error "Failed to build Docker images after $max_retries attempts."
    print_info "Check your internet connection and Docker daemon."
    exit 50
}

# =============================================================================
# Start Services
# =============================================================================

start_services() {
    print_header "STARTING SERVICES"

    cd "$INSTALL_DIR"

    print_step "Starting Edge Runtime containers..."
    docker compose up -d

    print_success "Services started"
}

# =============================================================================
# Health Checks
# =============================================================================

wait_for_health() {
    print_header "HEALTH CHECKS"

    local service_pg="postgres_${INSTANCE_NAME//-/_}"

    # ─── PostgreSQL ───────────────────────────────────────────────────────
    print_step "Waiting for PostgreSQL to become healthy..."
    local retries=0
    local max_retries=30
    until docker compose -f "$INSTALL_DIR/docker-compose.yml" exec -T "$service_pg" pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; do
        retries=$((retries + 1))
        if [[ $retries -ge $max_retries ]]; then
            print_error "PostgreSQL did not become ready after ${max_retries} attempts."
            cd "$INSTALL_DIR" && docker compose logs "$service_pg" --tail=30
            exit 61
        fi
        echo -ne "\r  Waiting... ($retries/$max_retries)"
        sleep 3
    done
    echo ""
    print_success "PostgreSQL is healthy"

    # ─── Kafka Connect ────────────────────────────────────────────────────
    print_step "Waiting for Kafka Connect to start (this may take 60-90 seconds)..."
    retries=0
    max_retries=60
    until curl -sf "http://localhost:${CONNECT_PORT}/" > /dev/null 2>&1; do
        retries=$((retries + 1))
        if [[ $retries -ge $max_retries ]]; then
            print_error "Kafka Connect did not start within the expected time."
            cd "$INSTALL_DIR" && docker compose logs "connect_${INSTANCE_NAME//-/_}" --tail=30
            exit 61
        fi
        echo -ne "\r  Waiting... ($retries/$max_retries)"
        sleep 5
    done
    echo ""
    print_success "Kafka Connect is ready"

    # ─── FreeRADIUS ───────────────────────────────────────────────────────
    if [[ "$INSTALL_FREERADIUS" == "y" ]]; then
        print_step "Checking FreeRADIUS..."
        sleep 5
        if docker compose -f "$INSTALL_DIR/docker-compose.yml" ps "freeradius_${INSTANCE_NAME//-/_}" --format '{{.State}}' 2>/dev/null | grep -qi running; then
            print_success "FreeRADIUS is running"
        else
            print_warning "FreeRADIUS may not be running. Check with: ./status.sh"
        fi
    fi

    # ─── RadiusSyncService ────────────────────────────────────────────────
    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        print_step "Waiting for RadiusSyncService to start..."
        retries=0
        max_retries=40
        until curl -sf "http://localhost:${SYNC_SERVICE_PORT}/health" > /dev/null 2>&1; do
            retries=$((retries + 1))
            if [[ $retries -ge $max_retries ]]; then
                print_warning "RadiusSyncService did not become healthy within the expected time."
                print_info "Check logs: docker compose logs syncservice_${INSTANCE_NAME//-/_} --tail=30"
                break
            fi
            echo -ne "\r  Waiting... ($retries/$max_retries)"
            sleep 5
        done
        if [[ $retries -lt $max_retries ]]; then
            echo ""
            print_success "RadiusSyncService is healthy"
            # Check SignalR connection status
            local sync_status
            sync_status=$(curl -sf "http://localhost:${SYNC_SERVICE_PORT}/status" 2>/dev/null || echo "{}")
            local signalr_connected
            signalr_connected=$(echo "$sync_status" | jq -r '.signalRConnected' 2>/dev/null || echo "unknown")
            if [[ "$signalr_connected" == "true" ]]; then
                print_success "SignalR Hub connection established"
            else
                print_warning "SignalR Hub not yet connected (will retry automatically)"
                print_info "Hub URL: ${SIGNALR_HUB_URL}"
            fi
        fi
    fi
}

# =============================================================================
# Register Connector
# =============================================================================

register_connector() {
    print_header "REGISTERING JDBC SINK CONNECTOR"

    cd "$INSTALL_DIR"
    ./register-connector.sh

    # Verify connector is running
    sleep 10
    local connector_name="jdbc-sink-${INSTANCE_NAME}"
    local status
    status=$(curl -sf "http://localhost:${CONNECT_PORT}/connectors/${connector_name}/status" 2>/dev/null | jq -r '.connector.state' 2>/dev/null || echo "UNKNOWN")

    if [[ "$status" == "RUNNING" ]]; then
        print_success "Connector '${connector_name}' is RUNNING"
    elif [[ "$status" == "UNKNOWN" ]]; then
        print_warning "Could not verify connector status. Check with: ./status.sh"
    else
        print_warning "Connector state: $status — may need investigation"
        print_info "Check connector logs: docker compose logs connect_${INSTANCE_NAME//-/_}"
    fi
}

# =============================================================================
# Configure FreeRADIUS (Optional)
# =============================================================================

configure_freeradius() {
    if [[ "$INSTALL_FREERADIUS" != "y" ]]; then
        print_info "FreeRADIUS not selected — skipping"
        return 0
    fi

    print_header "CONFIGURING FREERADIUS"
    print_step "FreeRADIUS container is running with default configuration."
    print_info "NAS Secret: $NAS_SECRET"
    print_info "Auth Port:  1812/udp"
    print_info "Acct Port:  1813/udp"
    print_info "For advanced FreeRADIUS configuration, modify the container or mount custom configs."
    print_success "FreeRADIUS configured"
}

# =============================================================================
# Save Credentials
# =============================================================================

save_credentials() {
    print_header "SAVING CREDENTIALS"

    local creds_file="$INSTALL_DIR/edge-credentials-$(date +%Y%m%d-%H%M%S).txt"

    cat > "$creds_file" << CREDS_EOF
# =============================================================================
# OpenRadius Edge Runtime — Credentials
# =============================================================================
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Instance:  ${INSTANCE_NAME}
# Site ID:   ${EDGE_SITE_ID}
#
# ⚠️  STORE THIS FILE SECURELY — It contains all access credentials.
# =============================================================================

Instance Name:    ${INSTANCE_NAME}
Install Dir:      ${INSTALL_DIR}
Edge Site ID:     ${EDGE_SITE_ID}

# PostgreSQL Database
  Host:           localhost
  Port:           ${POSTGRES_PORT}
  Database:       ${POSTGRES_DB}
  User:           ${POSTGRES_USER}
  Password:       ${POSTGRES_PASSWORD}
  Connection:     postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}

# Kafka Connect REST API
  URL:            http://localhost:${CONNECT_PORT}
  Connectors:     http://localhost:${CONNECT_PORT}/connectors

# Kafka Broker (Central)
  Bootstrap:      ${KAFKA_BOOTSTRAP_SERVER}
  SASL Username:  ${KAFKA_SASL_USERNAME}
  SASL Password:  ${KAFKA_SASL_PASSWORD}

# CDC Topics
  Topics:         ${TOPICS}
  Server Name:    ${SERVER_NAME}
  Group ID:       ${CONNECTOR_GROUP_ID}
CREDS_EOF

    if [[ "$INSTALL_FREERADIUS" == "y" ]]; then
        cat >> "$creds_file" << RADIUS_CREDS_EOF

# FreeRADIUS
  Auth Port:      1812/udp
  Acct Port:      1813/udp
  NAS Secret:     ${NAS_SECRET}
RADIUS_CREDS_EOF
    fi

    if [[ -n "$CENTRAL_API_URL" ]]; then
        cat >> "$creds_file" << API_CREDS_EOF

# Central API
  URL:            ${CENTRAL_API_URL}
API_CREDS_EOF
    fi

    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        cat >> "$creds_file" << SYNC_CREDS_EOF

# RadiusSyncService
  URL:            http://localhost:${SYNC_SERVICE_PORT}
  Health:         http://localhost:${SYNC_SERVICE_PORT}/health
  Status:         http://localhost:${SYNC_SERVICE_PORT}/status
  SignalR Hub:    ${SIGNALR_HUB_URL}
SYNC_CREDS_EOF
    fi

    chmod 600 "$creds_file"
    print_success "Credentials saved to: $creds_file"
    print_warning "Store this file securely and restrict access."
}

# =============================================================================
# Setup Monitoring (Optional)
# =============================================================================

setup_monitoring() {
    if [[ "$ENABLE_MONITORING" != "y" ]]; then
        print_info "Monitoring not selected — skipping"
        return 0
    fi

    print_header "CONFIGURING MONITORING"

    # Setup daily backup cron
    print_step "Setting up daily backup cron job..."
    local cron_entry="0 2 * * * ${INSTALL_DIR}/backup.sh >> ${INSTALL_DIR}/backup.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/backup.sh"; echo "$cron_entry") | crontab -
    print_success "Daily backup scheduled at 02:00"

    # Setup health check cron
    print_step "Setting up health check monitoring..."

    cat > "$INSTALL_DIR/healthcheck.sh" << 'HEALTH_EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Source config
source .edge-runtime.env

HEALTHY=true

# Check PostgreSQL
if ! docker compose exec -T postgres_${INSTANCE_NAME//-/_} pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
    echo "[$(date -Iseconds)] ALERT: PostgreSQL is down — restarting..."
    docker compose restart postgres_${INSTANCE_NAME//-/_}
    HEALTHY=false
fi

# Check Kafka Connect
if ! curl -sf "http://localhost:${CONNECT_PORT}/" > /dev/null 2>&1; then
    echo "[$(date -Iseconds)] ALERT: Kafka Connect is down — restarting..."
    docker compose restart connect_${INSTANCE_NAME//-/_}
    HEALTHY=false
fi

# Check connector status
CONNECTOR_STATUS=$(curl -sf "http://localhost:${CONNECT_PORT}/connectors/jdbc-sink-${INSTANCE_NAME}/status" 2>/dev/null | jq -r '.connector.state' 2>/dev/null || echo "UNKNOWN")
if [ "$CONNECTOR_STATUS" != "RUNNING" ]; then
    echo "[$(date -Iseconds)] ALERT: Connector state is $CONNECTOR_STATUS — attempting restart..."
    curl -sf -X POST "http://localhost:${CONNECT_PORT}/connectors/jdbc-sink-${INSTANCE_NAME}/restart" > /dev/null 2>&1 || true
    HEALTHY=false
fi

# Check RadiusSyncService
if [ "${INSTALL_SYNC_SERVICE}" = "y" ]; then
    if ! curl -sf "http://localhost:${SYNC_SERVICE_PORT}/health" > /dev/null 2>&1; then
        echo "[$(date -Iseconds)] ALERT: RadiusSyncService is unhealthy — restarting..."
        docker compose restart syncservice_${INSTANCE_NAME//-/_}
        HEALTHY=false
    fi
fi

if [ "$HEALTHY" = true ]; then
    echo "[$(date -Iseconds)] OK: All services healthy"
fi
HEALTH_EOF

    chmod +x "$INSTALL_DIR/healthcheck.sh"

    local health_cron="*/5 * * * * ${INSTALL_DIR}/healthcheck.sh >> ${INSTALL_DIR}/healthcheck.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/healthcheck.sh"; echo "$health_cron") | crontab -
    print_success "Health check monitoring scheduled (every 5 minutes)"

    print_success "Monitoring configured"
}

# =============================================================================
# Check for Existing Installation
# =============================================================================

check_existing_installation() {
    if [[ -z "$INSTALL_DIR" ]]; then
        return 0
    fi

    if [[ -d "$INSTALL_DIR" ]] && [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
        print_warning "Existing installation found at: $INSTALL_DIR"
        echo ""
        echo "  1) Overwrite (stop existing, remove, and reinstall)"
        echo "  2) Abort"
        echo -e "${CYAN}  Choose option [1/2]: ${NC}"
        read -p "  > " choice

        if [[ "$choice" == "1" ]]; then
            print_step "Stopping existing installation..."
            cd "$INSTALL_DIR"
            docker compose down 2>/dev/null || true
            print_success "Existing installation stopped"
        else
            print_error "Installation aborted."
            exit 0
        fi
    fi
}

# =============================================================================
# Installation Complete — Summary
# =============================================================================

show_summary() {
    local service_pg="postgres_${INSTANCE_NAME//-/_}"
    local service_connect="connect_${INSTANCE_NAME//-/_}"

    echo ""
    echo -e "${GREEN}${BOLD}"
    cat << 'BANNER_EOF'
   ╔═══════════════════════════════════════════════════════════════════════╗
   ║           OpenRadius Edge Runtime — Installation Complete!           ║
   ╚═══════════════════════════════════════════════════════════════════════╝
BANNER_EOF
    echo -e "${NC}"

    echo -e "  ${BOLD}Instance:${NC}    ${CYAN}${INSTANCE_NAME}${NC}"
    echo -e "  ${BOLD}Site ID:${NC}     ${CYAN}${EDGE_SITE_ID}${NC}"
    echo -e "  ${BOLD}Install Dir:${NC} ${CYAN}${INSTALL_DIR}${NC}"
    echo ""

    echo -e "  ${BOLD}┌──────────────────────┬─────────────────────────────────────────────┐${NC}"
    echo -e "  ${BOLD}│  Service             │  Endpoint                                   │${NC}"
    echo -e "  ${BOLD}├──────────────────────┼─────────────────────────────────────────────┤${NC}"
    echo -e "  │  PostgreSQL          │  localhost:${POSTGRES_PORT}                              │"
    echo -e "  │  Connect REST API    │  http://localhost:${CONNECT_PORT}                       │"
    echo -e "  │  Kafka Broker        │  ${KAFKA_BOOTSTRAP_SERVER}$(printf '%*s' $((25 - ${#KAFKA_BOOTSTRAP_SERVER})) '')│"
    if [[ "$INSTALL_FREERADIUS" == "y" ]]; then
        echo -e "  │  FreeRADIUS Auth     │  0.0.0.0:1812/udp                           │"
        echo -e "  │  FreeRADIUS Acct     │  0.0.0.0:1813/udp                           │"
    fi
    if [[ "$INSTALL_SYNC_SERVICE" == "y" ]]; then
        echo -e "  │  RadiusSyncService   │  http://localhost:${SYNC_SERVICE_PORT}                       │"
        echo -e "  │  SignalR Hub         │  ${SIGNALR_HUB_URL}$(printf '%*s' $((25 - ${#SIGNALR_HUB_URL})) '')│"
    fi
    echo -e "  ${BOLD}└──────────────────────┴─────────────────────────────────────────────┘${NC}"
    echo ""

    echo -e "  ${BOLD}Database Credentials:${NC}"
    echo "    Host:     localhost"
    echo "    Port:     ${POSTGRES_PORT}"
    echo "    Database: ${POSTGRES_DB}"
    echo "    User:     ${POSTGRES_USER}"
    echo "    Password: ${POSTGRES_PASSWORD}"
    echo ""

    echo -e "  ${BOLD}Syncing Topics:${NC}"
    IFS=',' read -ra topic_arr <<< "$TOPICS"
    for t in "${topic_arr[@]}"; do
        echo -e "    ${GRAY}• $(echo "$t" | xargs)${NC}"
    done
    echo ""

    echo -e "  ${BOLD}Management Commands:${NC}"
    echo "    Start:     ${INSTALL_DIR}/start.sh"
    echo "    Stop:      ${INSTALL_DIR}/stop.sh"
    echo "    Restart:   ${INSTALL_DIR}/restart.sh"
    echo "    Status:    ${INSTALL_DIR}/status.sh"
    echo "    Logs:      ${INSTALL_DIR}/logs.sh [service] [lines]"
    echo "    Backup:    ${INSTALL_DIR}/backup.sh"
    echo "    Update:    ${INSTALL_DIR}/update.sh"
    echo "    Uninstall: ${INSTALL_DIR}/uninstall.sh"
    echo ""

    echo -e "  ${YELLOW}${BOLD}IMPORTANT:${NC}"
    echo -e "  ${YELLOW}• Credentials saved to: ${INSTALL_DIR}/edge-credentials-*.txt${NC}"
    echo -e "  ${YELLOW}• Config saved to: ${INSTALL_DIR}/.edge-runtime.env${NC}"
    echo -e "  ${YELLOW}• Store credentials securely — the password was auto-generated.${NC}"
    echo -e "  ${YELLOW}• Full install log: ${LOG_FILE}${NC}"
    echo ""

    if [[ -n "$CENTRAL_API_URL" ]]; then
        echo -e "  ${CYAN}Central API: ${CENTRAL_API_URL}${NC}"
        echo ""
    fi
}

# =============================================================================
# Main Installation Flow
# =============================================================================

main() {
    # Parse CLI arguments FIRST
    parse_args "$@"

    # Auto-elevate to root
    if [[ $EUID -ne 0 ]]; then
        echo -e "${YELLOW}  This script requires root privileges. Re-running with sudo...${NC}"
        exec sudo bash "$0" "$@"
        exit $?
    fi

    # Resume mode
    if [[ "$RESUME" == "true" ]]; then
        load_checkpoint
        print_header "RESUMING EDGE RUNTIME INSTALLATION"
        print_info "Skipping previously completed steps..."
        echo ""
    fi

    # Unattended mode
    if [[ "$UNATTENDED" == "true" ]]; then
        if [[ -z "$CONFIG_FILE" ]]; then
            print_error "--unattended requires --config <file>"
            show_usage
            exit 31
        fi
        load_unattended_config
    fi

    clear

    # ASCII Art Banner
    echo -e "${CYAN}${BOLD}"
    cat << 'BANNER'
   ___                   ____            _ _                _____ _           
  / _ \ _ __   ___ _ __ |  _ \ __ _  __| (_)_   _ ___     | ____| __| | __ _  ___ 
 | | | | '_ \ / _ \ '_ \| |_) / _` |/ _` | | | | / __|   |  _| / _` |/ _` |/ _ \
 | |_| | |_) |  __/ | | |  _ < (_| | (_| | | |_| \__ \   | |__| (_| | (_| |  __/
  \___/| .__/ \___|_| |_|_| \_\__,_|\__,_|_|\__,_|___/   |_____\__,_|\__, |\___|
       |_|                    Runtime                                   |___/      
BANNER
    echo -e "${NC}"
    echo -e "  ${GRAY}Version ${GREEN}${EDGE_RUNTIME_VERSION}${GRAY}  •  Debezium ${DEBEZIUM_CONNECT_VERSION}  •  PostgreSQL ${POSTGRES_VERSION}  •  .NET ${DOTNET_RUNTIME_VERSION}${NC}"
    echo ""

    print_header "OpenRadius Edge Runtime Installation v${EDGE_RUNTIME_VERSION}"

    echo -e "  ${CYAN}This script will install and configure:${NC}"
    echo "    • Docker & Docker Compose (if not present)"
    echo "    • PostgreSQL ${POSTGRES_VERSION} — local edge database"
    echo "    • Debezium Connect ${DEBEZIUM_CONNECT_VERSION} — JDBC Sink Connector"
    echo "    • Real-time CDC sync from central Kafka/Redpanda"
    echo "    • RadiusSyncService — SignalR monitoring & Docker management"
    echo "    • FreeRADIUS (optional — for local RADIUS auth)"
    echo "    • Management scripts (start, stop, backup, status, etc.)"
    echo ""

    if [[ "$RESUME" == "true" ]]; then
        print_info "Mode: RESUME (from checkpoint)"
    elif [[ "$UNATTENDED" == "true" ]]; then
        print_info "Mode: UNATTENDED (config: $CONFIG_FILE)"
    else
        print_info "Mode: INTERACTIVE"
    fi

    log "[MAIN] Starting installation. Mode: $(if [[ "$RESUME" == "true" ]]; then echo 'resume'; elif [[ "$UNATTENDED" == "true" ]]; then echo 'unattended'; else echo 'interactive'; fi)"

    # Interactive confirmation
    if [[ "$UNATTENDED" != "true" && "$RESUME" != "true" ]]; then
        echo ""
        echo -e "${YELLOW}  Do you want to continue? [Y/n]: ${NC}"
        read -p "  > " confirm
        confirm="${confirm,,}"
        if [[ "$confirm" == "n" ]]; then
            print_error "Installation cancelled"
            exit 0
        fi
    fi

    # =========================================================================
    # Phase 1: Collect Configuration (before preflight, so we know ports)
    # =========================================================================
    run_step "collect_configuration" collect_configuration

    # Initialize logging (now that INSTALL_DIR is known)
    init_logging "$@"

    # =========================================================================
    # Phase 2: Pre-Flight Checks
    # =========================================================================
    run_step "preflight_checks" preflight_checks

    # =========================================================================
    # Phase 3: Check Existing Installation
    # =========================================================================
    run_step "check_existing_installation" check_existing_installation

    # =========================================================================
    # Phase 4: Install Dependencies
    # =========================================================================
    run_step "install_docker" install_docker
    run_step "install_prerequisites" install_prerequisites

    # =========================================================================
    # Phase 5: Verify Connectivity
    # =========================================================================
    run_step "verify_kafka_connectivity" verify_kafka_connectivity

    # =========================================================================
    # Phase 6: Generate All Config Files
    # =========================================================================
    run_step "generate_configs" generate_configs
    run_step "generate_management_scripts" generate_management_scripts

    # =========================================================================
    # Phase 7: Build & Deploy
    # =========================================================================
    run_step "build_images" build_images
    run_step "start_services" start_services
    run_step "wait_for_health" wait_for_health
    run_step "register_connector" register_connector

    # =========================================================================
    # Phase 8: Optional Configuration
    # =========================================================================
    run_step "configure_freeradius" configure_freeradius

    # =========================================================================
    # Phase 9: Post-Installation
    # =========================================================================
    run_step "save_credentials" save_credentials
    run_step "setup_monitoring" setup_monitoring

    # =========================================================================
    # Success — Clean up checkpoint and show summary
    # =========================================================================
    trap - EXIT

    rm -f "$CHECKPOINT_FILE" 2>/dev/null || true
    log "[CHECKPOINT] Removed (installation successful)"

    # Calculate total install time
    local install_end_time
    install_end_time=$(date +%s)
    local install_duration=$((install_end_time - INSTALL_START_TIME))
    local install_mins=$((install_duration / 60))
    local install_secs=$((install_duration % 60))
    log "[MAIN] Installation completed in ${install_mins}m ${install_secs}s"

    # Show summary
    show_summary

    echo -e "  ${GREEN}Total installation time: ${install_mins}m ${install_secs}s${NC}"
    echo -e "  ${CYAN}Full install log: ${GREEN}${LOG_FILE}${NC}"
    echo ""
    print_success "Edge Runtime installation complete!"
    log "[MAIN] === EDGE RUNTIME INSTALLATION SUCCESSFUL ==="
}

# Run main function with all CLI args
main "$@"
