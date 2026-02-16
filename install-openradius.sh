#!/bin/bash

# =============================================================================
# OpenRadius Enterprise Installation Script
# =============================================================================
# This script installs Docker, Docker Compose, and sets up OpenRadius
# with nginx reverse proxy for production deployment on Ubuntu.
#
# Usage:
#   Interactive:    sudo ./install-openradius.sh
#   Unattended:     sudo ./install-openradius.sh --unattended --config /path/to/config.yml
#   Resume failed:  sudo ./install-openradius.sh --resume
#   Specific step:  sudo ./install-openradius.sh --resume --from pull_docker_images
#
# Exit Codes:
#   0   Success
#   1   General / unknown error
#   10  Pre-flight check failed (disk, RAM, CPU, DNS, ports)
#   11  OS not supported
#   12  Missing root / sudo privileges
#   20  Docker installation failed
#   21  Docker Compose installation failed
#   22  Prerequisites installation failed
#   30  Configuration validation failed
#   31  Unattended config file not found or invalid
#   40  SSL certificate generation failed (non-fatal, self-signed used)
#   50  Git clone failed
#   60  Docker image pull failed
#   70  Service startup failed
#   71  Health check timeout
#   80  Keycloak configuration failed (non-fatal)
#   90  Cleanup / rollback in progress
#
# Powered By: Ali Al-Estarbadee
# Email: ali87mohammed@hotmail.com
# =============================================================================

# Version
OPENRADIUS_VERSION="2.0"

# =============================================================================
# Strict Mode & Globals
# =============================================================================
set -o pipefail  # Catch pipe failures

INSTALL_DIR="/opt/openradius"
LOG_FILE="/opt/openradius/install.log"
CHECKPOINT_FILE="/opt/openradius/.install-checkpoint"
UNATTENDED=false
RESUME=false
RESUME_FROM=""
CONFIG_FILE=""
INSTALL_START_TIME=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# =============================================================================
# Logging Infrastructure
# =============================================================================
# All output is tee'd to both console and log file with ISO 8601 timestamps.
# The log file captures stdout + stderr for post-mortem analysis.
# =============================================================================

init_logging() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    # Rotate old log if > 10MB
    if [[ -f "$LOG_FILE" ]] && [[ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt 10485760 ]]; then
        mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d-%H%M%S).bak"
    fi
    echo "" >> "$LOG_FILE"
    echo "# ================================================================" >> "$LOG_FILE"
    echo "# OpenRadius Installation — $(date -Iseconds)" >> "$LOG_FILE"
    echo "# Version: $OPENRADIUS_VERSION" >> "$LOG_FILE"
    echo "# Hostname: $(hostname -f 2>/dev/null || hostname)" >> "$LOG_FILE"
    echo "# Kernel: $(uname -r)" >> "$LOG_FILE"
    echo "# User: $(whoami) (UID=$EUID)" >> "$LOG_FILE"
    echo "# Command: $0 $*" >> "$LOG_FILE"
    echo "# ================================================================" >> "$LOG_FILE"
}

# Timestamped log entry (to file only)
log() {
    echo "[$(date -Iseconds)] $*" >> "$LOG_FILE"
}

# Timestamped log entry (to file + stderr for debug)
log_debug() {
    echo "[$(date -Iseconds)] [DEBUG] $*" >> "$LOG_FILE"
}

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    local msg="$1"
    echo -e "\n${PURPLE}================================================================================================${NC}"
    echo -e "${PURPLE}$msg${NC}"
    echo -e "${PURPLE}================================================================================================${NC}\n"
    log "===== $msg ====="
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    log "[OK]    $1"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    log "[ERROR] $1"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    log "[WARN]  $1"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
    log "[INFO]  $1"
}

print_step() {
    echo -e "${BLUE}➜ $1${NC}"
    log "[STEP]  $1"
}

# =============================================================================
# Error Handling & Cleanup Trap
# =============================================================================
# On any unexpected failure the trap logs the error, prints diagnostics,
# saves a checkpoint for --resume, and exits with a structured code.
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
        print_info "  sudo ./install-openradius.sh --resume"
    fi

    # Diagnostics
    print_info "Diagnostics:"
    print_info "  Install log: $LOG_FILE"
    print_info "  Last 20 lines of log:"
    tail -20 "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
        echo -e "    ${GRAY}$line${NC}"
    done

    # Show Docker status if relevant
    if command -v docker &>/dev/null; then
        local running=$(docker ps --format '{{.Names}} ({{.Status}})' 2>/dev/null | grep openradius | head -5)
        if [[ -n "$running" ]]; then
            print_info "  Running containers:"
            echo "$running" | while IFS= read -r line; do
                echo -e "    ${GRAY}$line${NC}"
            done
        fi
    fi

    echo ""
    print_warning "To retry from the failed step: sudo ./install-openradius.sh --resume"
    print_warning "To start fresh: sudo ./install-openradius.sh"
    echo ""

    exit $LAST_EXIT_CODE
}

trap cleanup_on_error EXIT

# Wrapper to run a step with checkpoint tracking
run_step() {
    local step_name="$1"
    local step_func="$2"

    # If resuming, skip completed steps
    if [[ "$RESUME" == "true" && -f "$CHECKPOINT_FILE" ]]; then
        local completed=$(grep "^COMPLETED:" "$CHECKPOINT_FILE" | cut -d: -f2)
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
    local step_start=$(date +%s)

    # Run the step (set -e is handled by the trap)
    $step_func

    local step_end=$(date +%s)
    local step_duration=$((step_end - step_start))
    log "[END]   $step_name (${step_duration}s)"
    mark_checkpoint_complete "$step_name"
    CURRENT_STEP=""
}

# =============================================================================
# Checkpoint System
# =============================================================================
# Saves progress so a failed install can resume from the last successful step.
# Checkpoint file format:
#   COMPLETED:step_name
#   VAR:DOMAIN=example.com
#   VAR:POSTGRES_PASSWORD=...
# =============================================================================

save_checkpoint() {
    local failed_step="$1"
    mkdir -p "$(dirname "$CHECKPOINT_FILE")" 2>/dev/null || true

    {
        echo "# OpenRadius Install Checkpoint — $(date -Iseconds)"
        echo "FAILED_AT:$failed_step"
        # Save all configuration variables so resume can skip collect_configuration
        for var in DOMAIN SSL_EMAIL POSTGRES_PASSWORD KEYCLOAK_ADMIN_PASSWORD REDIS_PASSWORD \
                   OPENRADIUS_USER_PASSWORD SEQ_API_KEY SWITCH_DECRYPTION_KEY \
                   REDPANDA_CONSOLE_PASSWORD SEQ_CONSOLE_PASSWORD CDC_CONSOLE_PASSWORD \
                   KAFKA_SASL_PASSWORD INSTALL_SAMPLE CONFIGURE_KEYCLOAK ENABLE_BACKUP \
                   SKIP_SSL; do
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
    if [[ -f "$CHECKPOINT_FILE" ]]; then
        echo "COMPLETED:$step_name" >> "$CHECKPOINT_FILE"
    else
        echo "COMPLETED:$step_name" > "$CHECKPOINT_FILE"
        chmod 600 "$CHECKPOINT_FILE"
    fi
}

load_checkpoint() {
    if [[ ! -f "$CHECKPOINT_FILE" ]]; then
        print_error "No checkpoint file found at $CHECKPOINT_FILE"
        print_info "Run without --resume for a fresh installation."
        exit 31
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

    local failed_at=$(grep "^FAILED_AT:" "$CHECKPOINT_FILE" | tail -1 | cut -d: -f2)
    local completed_count=$(grep -c "^COMPLETED:" "$CHECKPOINT_FILE" || true)
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
                echo "OpenRadius Installer v${OPENRADIUS_VERSION}"
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
Usage: sudo ./install-openradius.sh [OPTIONS]

Options:
  --unattended, -u        Non-interactive mode (requires --config)
  --config, -c FILE       Path to YAML/env config file for unattended install
  --resume, -r            Resume a previously failed installation
  --from STEP             Resume from a specific step (use with --resume)
  --log FILE              Custom log file path (default: /opt/openradius/install.log)
  --version, -v           Show version and exit
  --help, -h              Show this help message

Unattended Config File Format (install-config.env):
  DOMAIN=example.com
  SSL_EMAIL=admin@example.com
  PASSWORD_MODE=auto          # auto | custom
  POSTGRES_PASSWORD=...       # only if PASSWORD_MODE=custom
  KEYCLOAK_ADMIN_PASSWORD=... # only if PASSWORD_MODE=custom
  REDIS_PASSWORD=...          # only if PASSWORD_MODE=custom
  INSTALL_SAMPLE=n
  CONFIGURE_KEYCLOAK=y
  ENABLE_BACKUP=y
  SKIP_SSL=false              # true to skip Let's Encrypt

Examples:
  # Fresh interactive install
  sudo ./install-openradius.sh

  # Unattended install
  sudo ./install-openradius.sh --unattended --config /root/install-config.env

  # Resume after failure
  sudo ./install-openradius.sh --resume

  # Resume from a specific step
  sudo ./install-openradius.sh --resume --from pull_docker_images

Steps (for --from):
  preflight_checks, install_docker, install_docker_compose, install_prerequisites,
  configure_firewall, collect_configuration, generate_env_file, save_credentials,
  show_dns_instructions, generate_ssl_certificates, clone_repository,
  configure_nginx, generate_htpasswd_files, generate_edge_env,
  prepare_keycloak_import, pull_docker_images, start_services,
  wait_for_services, configure_keycloak, setup_backup
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
    source "$CONFIG_FILE"
    set +a

    # Validate required fields
    local missing=()
    [[ -z "${DOMAIN:-}" ]] && missing+=("DOMAIN")
    [[ -z "${SSL_EMAIL:-}" ]] && missing+=("SSL_EMAIL")

    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required fields in config file: ${missing[*]}"
        exit 31
    fi

    if ! validate_domain "$DOMAIN"; then
        print_error "Invalid domain in config: $DOMAIN"
        exit 30
    fi

    if ! validate_email "$SSL_EMAIL"; then
        print_error "Invalid email in config: $SSL_EMAIL"
        exit 30
    fi

    # Auto-generate passwords if not provided or PASSWORD_MODE=auto
    local pw_mode="${PASSWORD_MODE:-auto}"
    if [[ "$pw_mode" == "auto" ]]; then
        print_step "Generating secure passwords (unattended)..."
        POSTGRES_PASSWORD=$(generate_password 32)
        KEYCLOAK_ADMIN_PASSWORD=$(generate_password 32)
        REDIS_PASSWORD=$(generate_password 32)
        OPENRADIUS_USER_PASSWORD=$(generate_password 24)
        SEQ_API_KEY=$(generate_password 32)
        SWITCH_DECRYPTION_KEY=$(generate_hex_key)
        REDPANDA_CONSOLE_PASSWORD=$(generate_password 24)
        SEQ_CONSOLE_PASSWORD=$(generate_password 24)
        CDC_CONSOLE_PASSWORD=$(generate_password 24)
        KAFKA_SASL_PASSWORD=$(generate_password 32)
        print_success "Passwords auto-generated"
    else
        # Validate custom passwords
        for var in POSTGRES_PASSWORD KEYCLOAK_ADMIN_PASSWORD REDIS_PASSWORD; do
            if [[ ${#!var} -lt 16 ]]; then
                print_error "$var must be at least 16 characters"
                exit 30
            fi
        done
        # Auto-generate the rest
        : "${OPENRADIUS_USER_PASSWORD:=$(generate_password 24)}"
        : "${SEQ_API_KEY:=$(generate_password 32)}"
        : "${SWITCH_DECRYPTION_KEY:=$(generate_hex_key)}"
        : "${REDPANDA_CONSOLE_PASSWORD:=$(generate_password 24)}"
        : "${SEQ_CONSOLE_PASSWORD:=$(generate_password 24)}"
        : "${CDC_CONSOLE_PASSWORD:=$(generate_password 24)}"
        : "${KAFKA_SASL_PASSWORD:=$(generate_password 32)}"
    fi

    # Defaults
    : "${INSTALL_SAMPLE:=n}"
    : "${CONFIGURE_KEYCLOAK:=y}"
    : "${ENABLE_BACKUP:=y}"
    : "${SKIP_SSL:=false}"

    print_success "Unattended configuration loaded and validated"
}

# =============================================================================
# Pre-Flight Checks
# =============================================================================
# Validates system readiness before starting installation:
#   - Disk space (min 20GB free)
#   - RAM (min 4GB, recommended 8GB)
#   - CPU cores (min 2)
#   - DNS resolution for the domain
#   - Port availability (80, 443, 9094)
#   - Required commands
# =============================================================================

preflight_checks() {
    print_header "PRE-FLIGHT CHECKS"
    local warnings=0
    local errors=0

    # --- Disk Space ---
    local disk_avail_kb=$(df /opt 2>/dev/null | awk 'NR==2 {print $4}' || df / | awk 'NR==2 {print $4}')
    local disk_avail_gb=$((disk_avail_kb / 1024 / 1024))
    if [[ $disk_avail_gb -lt 10 ]]; then
        print_error "Insufficient disk space: ${disk_avail_gb}GB available (minimum: 10GB)"
        errors=$((errors + 1))
    elif [[ $disk_avail_gb -lt 20 ]]; then
        print_warning "Low disk space: ${disk_avail_gb}GB available (recommended: 20GB+)"
        warnings=$((warnings + 1))
    else
        print_success "Disk space: ${disk_avail_gb}GB available"
    fi

    # --- RAM ---
    local ram_total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local ram_total_gb=$((ram_total_kb / 1024 / 1024))
    local ram_total_mb=$((ram_total_kb / 1024))
    if [[ $ram_total_mb -lt 3500 ]]; then
        print_error "Insufficient RAM: ${ram_total_mb}MB (minimum: 4GB)"
        errors=$((errors + 1))
    elif [[ $ram_total_mb -lt 7500 ]]; then
        print_warning "RAM: ${ram_total_mb}MB (recommended: 8GB+ for production)"
        warnings=$((warnings + 1))
    else
        print_success "RAM: ${ram_total_mb}MB (${ram_total_gb}GB)"
    fi

    # --- CPU Cores ---
    local cpu_cores=$(nproc 2>/dev/null || echo 1)
    if [[ $cpu_cores -lt 2 ]]; then
        print_error "Insufficient CPU: $cpu_cores core(s) (minimum: 2)"
        errors=$((errors + 1))
    elif [[ $cpu_cores -lt 4 ]]; then
        print_warning "CPU: $cpu_cores cores (recommended: 4+ for production)"
        warnings=$((warnings + 1))
    else
        print_success "CPU: $cpu_cores cores"
    fi

    # --- DNS Resolution ---
    if [[ -n "${DOMAIN:-}" ]]; then
        local server_ip=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "")
        if [[ -n "$server_ip" ]]; then
            local dns_result=$(dig +short "$DOMAIN" A 2>/dev/null | head -1)
            if [[ -z "$dns_result" ]]; then
                print_warning "DNS: $DOMAIN does not resolve yet (configure after install)"
                warnings=$((warnings + 1))
            elif [[ "$dns_result" == "$server_ip" ]]; then
                print_success "DNS: $DOMAIN → $server_ip ✓"
            else
                print_warning "DNS: $DOMAIN → $dns_result (expected $server_ip)"
                warnings=$((warnings + 1))
            fi
        else
            print_warning "Cannot determine server IP — DNS check skipped"
            warnings=$((warnings + 1))
        fi
    fi

    # --- Port Availability ---
    for port in 80 443 9094; do
        if ss -tlnp 2>/dev/null | grep -q ":${port} " || netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
            local proc=$(ss -tlnp 2>/dev/null | grep ":${port} " | awk '{print $NF}' | head -1)
            print_warning "Port $port is in use by: $proc"
            warnings=$((warnings + 1))
        else
            print_success "Port $port: available"
        fi
    done

    # --- Required Commands ---
    for cmd in curl openssl git; do
        if command -v "$cmd" &>/dev/null; then
            print_success "Command: $cmd ✓"
        else
            print_warning "Command: $cmd not found (will be installed)"
            warnings=$((warnings + 1))
        fi
    done

    # --- Internet Connectivity ---
    if curl -s --connect-timeout 5 https://github.com > /dev/null 2>&1; then
        print_success "Internet: reachable (github.com)"
    elif curl -s --connect-timeout 5 https://hub.docker.com > /dev/null 2>&1; then
        print_success "Internet: reachable (hub.docker.com)"
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
        echo -e "${YELLOW}Continue anyway? (NOT recommended) [y/N]: ${NC}"
        read -p "> " force_continue
        if [[ "${force_continue,,}" != "y" ]]; then
            exit 10
        fi
        print_warning "Continuing despite pre-flight failures — you have been warned!"
    elif [[ $warnings -gt 0 ]]; then
        print_warning "Pre-flight completed with $warnings warning(s)"
    else
        print_success "All pre-flight checks passed"
    fi
}

# Generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate hex key
generate_hex_key() {
    openssl rand -hex 16
}

# Validate domain name
validate_domain() {
    local domain=$1
    if [[ ! $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        return 1
    fi
    return 0
}

# Validate email
validate_email() {
    local email=$1
    if [[ ! $email =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 1
    fi
    return 0
}

# Check if running as root or has sudo access
check_root() {
    if [[ $EUID -eq 0 ]]; then
        IS_ROOT=true
        print_success "Running as root user"
    else
        IS_ROOT=false
        print_warning "Running as non-root user. Sudo privileges required."
    fi
}

# Check if user has sudo privileges
check_sudo() {
    if [[ "$IS_ROOT" == "true" ]]; then
        # Running as root, no need for sudo
        return 0
    fi
    
    print_info "Checking sudo privileges..."
    if ! sudo -v; then
        print_error "Sudo privileges required. Please run with sudo or as root."
        exit 12
    fi
    print_success "Sudo access confirmed"
}

# Check Ubuntu version
check_ubuntu() {
    if [[ ! -f /etc/os-release ]]; then
        print_error "Cannot detect OS. This script is designed for Ubuntu."
        exit 11
    fi
    
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        print_error "This script is designed for Ubuntu. Detected: $ID"
        exit 11
    fi
    
    print_success "Ubuntu $VERSION_ID detected"
}

# Helper function for sudo commands
run_sudo() {
    if [[ "$IS_ROOT" == "true" ]]; then
        "$@"
    else
        sudo "$@"
    fi
}

# =============================================================================
# Docker Installation
# =============================================================================

install_docker() {
    print_step "Checking Docker installation..."
    
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version | awk '{print $3}' | tr -d ',')
        print_success "Docker is already installed (version $docker_version)"
        return 0
    fi
    
    print_step "Installing Docker..."
    
    # Update package index
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    print_success "Docker installed successfully"
    print_warning "You may need to log out and back in for group permissions to take effect"
}

# =============================================================================
# Docker Compose Installation
# =============================================================================

install_docker_compose() {
    print_step "Checking Docker Compose installation..."
    
    if docker compose version &> /dev/null; then
        local compose_version=$(docker compose version --short)
        print_success "Docker Compose is already installed (version $compose_version)"
        return 0
    fi
    
    print_success "Docker Compose plugin installed with Docker"
}

# =============================================================================
# System Prerequisites
# =============================================================================

install_prerequisites() {
    print_step "Installing system prerequisites..."
    
    sudo apt-get update
    sudo apt-get install -y \
        git \
        curl \
        wget \
        openssl \
        certbot \
        python3-certbot-nginx \
        ufw \
        jq \
        apache2-utils
    
    print_success "Prerequisites installed"
}

# =============================================================================
# Firewall Configuration
# =============================================================================

configure_firewall() {
    print_step "Configuring firewall..."
    
    # Enable UFW if not already enabled
    if ! sudo ufw status | grep -q "Status: active"; then
        sudo ufw --force enable
    fi
    
    # Allow SSH (important!)
    sudo ufw allow 22/tcp comment 'SSH'
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp comment 'HTTP'
    sudo ufw allow 443/tcp comment 'HTTPS'
    
    # Allow Kafka broker for Edge Runtime CDC consumers (SASL/SCRAM protected)
    # NOTE: For additional security, restrict to known Edge IPs:
    #   sudo ufw delete allow 9094/tcp
    #   sudo ufw allow from <EDGE_IP> to any port 9094 proto tcp comment 'Kafka - Edge Site 1'
    sudo ufw allow 9094/tcp comment 'Kafka Broker (SASL/SCRAM)'
    
    print_success "Firewall configured (ports 22, 80, 443, 9094 open)"
}

# =============================================================================
# Collect Configuration
# =============================================================================

collect_configuration() {
    # In unattended mode, configuration is already loaded from config file
    if [[ "$UNATTENDED" == "true" ]]; then
        print_header "CONFIGURATION (UNATTENDED)"
        print_success "Using pre-loaded configuration:"
        print_info "  Domain:     $DOMAIN"
        print_info "  SSL Email:  $SSL_EMAIL"
        print_info "  Sample:     $INSTALL_SAMPLE"
        print_info "  Keycloak:   $CONFIGURE_KEYCLOAK"
        print_info "  Backup:     $ENABLE_BACKUP"
        log "[CONFIG] Unattended: DOMAIN=$DOMAIN SSL_EMAIL=$SSL_EMAIL"
        return 0
    fi

    print_header "CONFIGURATION"
    
    # Domain Configuration
    while true; do
        echo -e "${CYAN}Enter your domain name (e.g., example.com): ${NC}"
        read -p "> " DOMAIN
        if validate_domain "$DOMAIN"; then
            break
        else
            print_error "Invalid domain name. Please try again."
        fi
    done
    
    # Email for Let's Encrypt
    while true; do
        echo -e "${CYAN}Enter your email for SSL certificates: ${NC}"
        read -p "> " SSL_EMAIL
        if validate_email "$SSL_EMAIL"; then
            break
        else
            print_error "Invalid email address. Please try again."
        fi
    done
    
    # Ask if user wants to generate passwords or provide their own
    echo -e "\n${YELLOW}Password Configuration${NC}"
    echo "1) Auto-generate secure passwords (recommended)"
    echo "2) Enter custom passwords"
    echo -e "${CYAN}Choose option [1/2]: ${NC}"
    read -p "> " password_option
    
    if [[ "$password_option" == "2" ]]; then
        # Custom passwords
        while true; do
            echo -e "${CYAN}Enter PostgreSQL password (min 16 characters): ${NC}"
            read -sp "> " POSTGRES_PASSWORD
            echo
            if [[ ${#POSTGRES_PASSWORD} -ge 16 ]]; then
                break
            else
                print_error "Password must be at least 16 characters"
            fi
        done
        
        while true; do
            echo -e "${CYAN}Enter Keycloak admin password (min 16 characters): ${NC}"
            read -sp "> " KEYCLOAK_ADMIN_PASSWORD
            echo
            if [[ ${#KEYCLOAK_ADMIN_PASSWORD} -ge 16 ]]; then
                break
            else
                print_error "Password must be at least 16 characters"
            fi
        done
        
        while true; do
            echo -e "${CYAN}Enter Redis password (min 16 characters): ${NC}"
            read -sp "> " REDIS_PASSWORD
            echo
            if [[ ${#REDIS_PASSWORD} -ge 16 ]]; then
                break
            else
                print_error "Password must be at least 16 characters"
            fi
        done
        
        SEQ_API_KEY=$(generate_password 32)
        SWITCH_DECRYPTION_KEY=$(generate_hex_key)
        REDPANDA_CONSOLE_PASSWORD=$(generate_password 24)
        SEQ_CONSOLE_PASSWORD=$(generate_password 24)
        CDC_CONSOLE_PASSWORD=$(generate_password 24)
        KAFKA_SASL_PASSWORD=$(generate_password 32)
    else
        # Auto-generate passwords
        print_step "Generating secure passwords..."
        POSTGRES_PASSWORD=$(generate_password 32)
        KEYCLOAK_ADMIN_PASSWORD=$(generate_password 32)
        REDIS_PASSWORD=$(generate_password 32)
        OPENRADIUS_USER_PASSWORD=$(generate_password 24)
        SEQ_API_KEY=$(generate_password 32)
        SWITCH_DECRYPTION_KEY=$(generate_hex_key)
        REDPANDA_CONSOLE_PASSWORD=$(generate_password 24)
        SEQ_CONSOLE_PASSWORD=$(generate_password 24)
        CDC_CONSOLE_PASSWORD=$(generate_password 24)
        KAFKA_SASL_PASSWORD=$(generate_password 32)
        print_success "Passwords generated"
    fi
    
    # Additional configuration
    echo -e "${CYAN}Install sample data? [y/N]: ${NC}"
    read -p "> " install_sample
    INSTALL_SAMPLE=${install_sample:-n}
    INSTALL_SAMPLE=${INSTALL_SAMPLE,,}  # Convert to lowercase
    
    # Keycloak auto-configuration
    echo -e "${CYAN}Auto-configure Keycloak realm and clients? [Y/n]: ${NC}"
    echo -e "${GRAY}  This will create: openradius realm, openradius-web client, openradius-admin client, openradius-api client${NC}"
    read -p "> " configure_keycloak
    CONFIGURE_KEYCLOAK=${configure_keycloak:-y}
    CONFIGURE_KEYCLOAK=${CONFIGURE_KEYCLOAK,,}  # Convert to lowercase
    
    # Backup configuration
    echo -e "${CYAN}Enable automated backups? [Y/n]: ${NC}"
    read -p "> " enable_backup
    ENABLE_BACKUP=${enable_backup:-y}
    ENABLE_BACKUP=${ENABLE_BACKUP,,}  # Convert to lowercase
}

# =============================================================================
# Generate Environment File
# =============================================================================

generate_env_file() {
    print_step "Generating .env file..."
    
    # Ensure /opt/openradius directory exists
    run_sudo mkdir -p /opt/openradius
    
    cat > /tmp/openradius.env << EOF
# =============================================================================
# OpenRadius Production Environment Configuration
# Generated on: $(date)
# =============================================================================

# =============================================================================
# Domain Configuration
# =============================================================================
DOMAIN=$DOMAIN

# =============================================================================
# Database Configuration
# =============================================================================
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# =============================================================================
# Keycloak Configuration
# =============================================================================
KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD

# =============================================================================
# Redis Configuration
# =============================================================================
REDIS_PASSWORD=$REDIS_PASSWORD

# =============================================================================
# OIDC Configuration
# =============================================================================
OIDC_AUTHORITY=https://auth.$DOMAIN/realms/openradius
OIDC_METADATA_ADDRESS=https://auth.$DOMAIN/realms/openradius/.well-known/openid-configuration
OIDC_ISSUER=https://auth.$DOMAIN/realms/openradius

# =============================================================================
# Seq Logging Configuration
# =============================================================================
SEQ_API_KEY=$SEQ_API_KEY

# =============================================================================
# Switch Decryption Configuration
# =============================================================================
SWITCH_DECRYPTION_KEY=$SWITCH_DECRYPTION_KEY

# =============================================================================
# Admin Console Passwords (Nginx Basic Auth)
# =============================================================================
REDPANDA_CONSOLE_PASSWORD=$REDPANDA_CONSOLE_PASSWORD
SEQ_CONSOLE_PASSWORD=$SEQ_CONSOLE_PASSWORD
CDC_CONSOLE_PASSWORD=$CDC_CONSOLE_PASSWORD

# =============================================================================
# Kafka/Redpanda SASL Authentication (Broker Security)
# =============================================================================
KAFKA_SASL_PASSWORD=$KAFKA_SASL_PASSWORD

# =============================================================================
# Docker Configuration (for system update feature)
# =============================================================================
DOCKER_GID=$(getent group docker | cut -d: -f3)
EOF
    
    # Move the env file to /opt/openradius with secure permissions
    run_sudo mv /tmp/openradius.env /opt/openradius/.env
    run_sudo chmod 600 /opt/openradius/.env
    print_success ".env file created with secure permissions (600)"
}

# =============================================================================
# Save Credentials
# =============================================================================

save_credentials() {
    print_step "Saving credentials to secure file..."
    
    # Save to /opt/openradius directory
    local creds_file="/opt/openradius/openradius-credentials-$(date +%Y%m%d-%H%M%S).txt"
    
    run_sudo tee "$creds_file" > /dev/null << EOF
# =============================================================================
# OpenRadius Installation Credentials
# Generated on: $(date)
# =============================================================================

IMPORTANT: Store this file securely and delete it after saving the credentials!

Domain: $DOMAIN
SSL Email: $SSL_EMAIL

PostgreSQL:
  - Database: openradius
  - Username: openradius
  - Password: $POSTGRES_PASSWORD

Keycloak Admin:
  - URL: https://auth.$DOMAIN/admin
  - Username: admin
  - Password: $KEYCLOAK_ADMIN_PASSWORD

OpenRadius Manager User:
  - URL: https://$DOMAIN
  - Username: openradius
  - Password: $OPENRADIUS_USER_PASSWORD

Redis:
  - Password: $REDIS_PASSWORD

Seq:
  - URL: https://logs.$DOMAIN
  - API Key: $SEQ_API_KEY

Switch Decryption Key: $SWITCH_DECRYPTION_KEY

Kafka Broker (SASL/SCRAM Authentication):
  - Broker: kafka.$DOMAIN:9094
  - Username: admin
  - Password: $KAFKA_SASL_PASSWORD
  - Mechanism: SCRAM-SHA-256
  - NOTE: EdgeRuntime sites need this password to connect

Admin Consoles (Nginx Basic Auth):
  Redpanda Console (https://kafka.$DOMAIN):
    - Username: admin
    - Password: $REDPANDA_CONSOLE_PASSWORD
  Seq Logs (https://logs.$DOMAIN):
    - Username: admin
    - Password: $SEQ_CONSOLE_PASSWORD
  Debezium CDC API (https://cdc.$DOMAIN):
    - Username: admin
    - Password: $CDC_CONSOLE_PASSWORD

# =============================================================================
# Service URLs
# =============================================================================
Main Application: https://$DOMAIN
API: https://api.$DOMAIN
Keycloak: https://auth.$DOMAIN
Seq Logs: https://logs.$DOMAIN
Kafka Console: https://kafka.$DOMAIN
Kafka Broker: kafka.$DOMAIN:9094
Debezium API: https://cdc.$DOMAIN

# =============================================================================
# Next Steps
# =============================================================================
1. Configure DNS records (see installation output)
2. Wait for SSL certificates to be issued
3. Access Keycloak admin to configure realm
4. Set up initial users and permissions

EOF
    
    run_sudo chmod 600 "$creds_file"
    print_success "Credentials saved to: $creds_file"
    print_warning "Store this file securely and delete it after recording the credentials!"
}

# =============================================================================
# DNS Configuration Instructions
# =============================================================================

show_dns_instructions() {
    print_header "DNS CONFIGURATION REQUIRED"
    
    echo -e "${YELLOW}Please configure the following DNS records at your domain registrar:${NC}\n"
    
    local server_ip=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    
    echo -e "${CYAN}A Records:${NC}"
    echo "  $DOMAIN              →  $server_ip"
    echo ""
    
    echo -e "${CYAN}CNAME Records:${NC}"
    echo "  api.$DOMAIN          →  $DOMAIN"
    echo "  auth.$DOMAIN         →  $DOMAIN"
    echo "  logs.$DOMAIN         →  $DOMAIN"
    echo "  kafka.$DOMAIN        →  $DOMAIN"
    echo "  cdc.$DOMAIN          →  $DOMAIN"
    echo ""
    
    # In unattended mode, skip the DNS prompt (use SKIP_SSL from config)
    if [[ "$UNATTENDED" == "true" ]]; then
        if [[ "$SKIP_SSL" == "true" ]]; then
            print_info "Unattended: SKIP_SSL=true — will use self-signed certificates"
        else
            print_info "Unattended: Will attempt Let's Encrypt SSL certificates"
        fi
        return 0
    fi

    echo -e "${YELLOW}Have you configured DNS records? [y/N]: ${NC}"
    read -p "> " dns_configured
    dns_configured=${dns_configured,,}  # Convert to lowercase
    
    if [[ "$dns_configured" != "y" ]]; then
        print_warning "Please configure DNS records before continuing."
        print_info "You can run the SSL certificate generation later with:"
        print_info "  sudo certbot --nginx -d $DOMAIN -d api.$DOMAIN -d auth.$DOMAIN -d logs.$DOMAIN -d kafka.$DOMAIN -d cdc.$DOMAIN"
        SKIP_SSL=true
    else
        SKIP_SSL=false
    fi
}

# =============================================================================
# SSL Certificate Generation
# =============================================================================

generate_ssl_certificates() {
    if [[ "$SKIP_SSL" == "true" ]]; then
        print_warning "Skipping SSL certificate generation"
        print_info "Generating self-signed certificates for testing..."
        
        sudo mkdir -p nginx/ssl
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
        
        print_success "Self-signed certificates generated"
        print_warning "Remember to generate Let's Encrypt certificates later!"
        return
    fi
    
    print_step "Generating SSL certificates with Let's Encrypt..."
    
    # Ensure certbot directories exist
    sudo mkdir -p /var/log/letsencrypt
    sudo mkdir -p /etc/letsencrypt
    sudo mkdir -p /var/lib/letsencrypt
    
    # Stop nginx if running (certbot needs port 80)
    if systemctl is-active --quiet nginx 2>/dev/null; then
        print_info "Stopping system nginx temporarily for certificate generation..."
        sudo systemctl stop nginx
        NGINX_WAS_RUNNING=true
    else
        NGINX_WAS_RUNNING=false
    fi
    
    # Stop any Docker containers using port 80
    print_info "Ensuring port 80 is available..."
    docker ps --format '{{.Names}}' | grep -q openradius-nginx && docker stop openradius-nginx 2>/dev/null || true
    
    # Generate certificates using standalone mode with verbose output
    print_info "Requesting SSL certificates from Let's Encrypt..."
    if sudo certbot certonly --standalone --non-interactive --agree-tos \
        --email "$SSL_EMAIL" \
        -d "$DOMAIN" \
        -d "api.$DOMAIN" \
        -d "auth.$DOMAIN" \
        -d "logs.$DOMAIN" \
        -d "kafka.$DOMAIN" \
        -d "cdc.$DOMAIN" 2>&1 | tee /tmp/certbot-output.log; then
        print_success "SSL certificates generated successfully"
    else
        print_error "Failed to generate SSL certificates"
        print_info "Check the log: cat /tmp/certbot-output.log"
        print_warning "Falling back to self-signed certificates for now..."
        
        # Create self-signed certificates as fallback
        sudo mkdir -p /opt/openradius/nginx/ssl
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /opt/openradius/nginx/ssl/privkey.pem \
            -out /opt/openradius/nginx/ssl/fullchain.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
        sudo chmod 644 /opt/openradius/nginx/ssl/fullchain.pem
        sudo chmod 600 /opt/openradius/nginx/ssl/privkey.pem
        
        print_warning "Using self-signed certificates. Generate real certificates later with:"
        print_info "  sudo certbot certonly --standalone -d $DOMAIN -d api.$DOMAIN -d auth.$DOMAIN -d logs.$DOMAIN -d kafka.$DOMAIN -d cdc.$DOMAIN"
        return
    fi
    
    # Only restart nginx if it was running before (system nginx, not Docker)
    if [[ "$NGINX_WAS_RUNNING" == "true" ]] && systemctl is-enabled --quiet nginx 2>/dev/null; then
        print_info "Restarting system nginx..."
        sudo systemctl start nginx
    fi
    
    # Copy actual certificate files to nginx/ssl directory (not symlinks)
    # Symlinks don't work in Docker volumes because the target path doesn't exist in container
    print_info "Copying SSL certificates to nginx directory..."
    sudo mkdir -p /opt/openradius/nginx/ssl
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/openradius/nginx/ssl/fullchain.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/openradius/nginx/ssl/privkey.pem
    sudo chmod 644 /opt/openradius/nginx/ssl/fullchain.pem
    sudo chmod 600 /opt/openradius/nginx/ssl/privkey.pem
    
    # Set up auto-renewal with certificate copy
    print_info "Setting up auto-renewal..."
    cat > /tmp/renew-certs.sh << 'RENEWSCRIPT'
#!/bin/bash
# Renew certificates and copy to nginx directory
certbot renew --quiet
if [ $? -eq 0 ]; then
    cp /etc/letsencrypt/live/*/fullchain.pem /opt/openradius/nginx/ssl/fullchain.pem
    cp /etc/letsencrypt/live/*/privkey.pem /opt/openradius/nginx/ssl/privkey.pem
    chmod 644 /opt/openradius/nginx/ssl/fullchain.pem
    chmod 600 /opt/openradius/nginx/ssl/privkey.pem
    cd /opt/openradius && docker compose -f docker-compose.prod.yml restart nginx
fi
RENEWSCRIPT
    sudo mv /tmp/renew-certs.sh /usr/local/bin/renew-openradius-certs.sh
    sudo chmod +x /usr/local/bin/renew-openradius-certs.sh
    echo "0 0 * * * root /usr/local/bin/renew-openradius-certs.sh" | sudo tee -a /etc/crontab
    
    print_success "SSL certificates generated and auto-renewal configured"
}

# =============================================================================
# Clone Repository
# =============================================================================

clone_repository() {
    print_step "Cloning OpenRadius repository..."
    
    local install_dir="/opt/openradius"
    
    # Ensure we're in a valid directory before cloning
    cd /tmp || cd / || {
        print_error "Failed to navigate to a valid directory"
        exit 50
    }
    
    # Clone repository (directory already exists with .env file)
    run_sudo git clone https://github.com/Ali-Mohammed/openRadius.git "$install_dir/temp"
    
    # Move repository contents to install_dir (preserving .env)
    run_sudo cp -r "$install_dir/temp/"* "$install_dir/"
    run_sudo cp -r "$install_dir/temp/".git* "$install_dir/" 2>/dev/null || true
    run_sudo rm -rf "$install_dir/temp"
    
    # Navigate to installation directory
    cd "$install_dir" || {
        print_error "Failed to navigate to installation directory"
        exit 50
    }
    
    print_success "Repository cloned to $install_dir"
}

# =============================================================================
# Configure Nginx Reverse Proxy
# =============================================================================
# Replaces the placeholder domain (open-radius.org) in the production nginx
# config with the user's actual domain. Without this, the reverse proxy
# will not route traffic to the correct virtual hosts.
# =============================================================================

configure_nginx() {
    print_step "Configuring nginx reverse proxy for $DOMAIN..."

    local nginx_conf="/opt/openradius/nginx/nginx.conf"

    if [ ! -f "$nginx_conf" ]; then
        print_warning "nginx.conf not found at $nginx_conf — skipping domain replacement"
        return
    fi

    # Replace all occurrences of the placeholder domain with the user's domain
    run_sudo sed -i "s|open-radius\.org|$DOMAIN|g" "$nginx_conf"

    print_success "Nginx configured for domain: $DOMAIN"
    print_info "  Subdomains: api.$DOMAIN, auth.$DOMAIN, logs.$DOMAIN, kafka.$DOMAIN, cdc.$DOMAIN"
    print_info "  Kafka Broker: kafka.$DOMAIN:9094"
}

# =============================================================================
# Prepare Keycloak Import (before starting containers)
# =============================================================================

prepare_keycloak_import() {
    if [[ "$CONFIGURE_KEYCLOAK" != "y" ]]; then
        return
    fi
    
    print_step "Preparing Keycloak realm configuration..."
    
    local install_dir="/opt/openradius"
    
    if [ -f "$install_dir/keycloak/keycloak-config.json" ]; then
        print_info "Found keycloak-config.json, preparing production config..."
        
        # Create a production-ready copy with domain URLs replaced
        cp "$install_dir/keycloak/keycloak-config.json" /tmp/keycloak-import.json
        
        # Update URLs with production domain
        sed -i "s|http://localhost:5173|https://$DOMAIN|g" /tmp/keycloak-import.json
        sed -i "s|http://localhost:8080|https://auth.$DOMAIN|g" /tmp/keycloak-import.json
        
        # Update openradius user password with generated one
        sed -i "s|CHANGE_ME_ON_FIRST_LOGIN|$OPENRADIUS_USER_PASSWORD|g" /tmp/keycloak-import.json
        
        print_success "Keycloak realm config prepared with production URLs"
    else
        print_warning "keycloak-config.json not found at $install_dir/keycloak/"
        print_info "Realm will be created manually after Keycloak starts"
    fi
}

# =============================================================================
# Generate .htpasswd Files for Admin Consoles
# =============================================================================

generate_htpasswd_files() {
    print_step "Generating .htpasswd files for admin consoles..."

    local ssl_dir="/opt/openradius/nginx/ssl"

    # Ensure ssl directory exists
    run_sudo mkdir -p "$ssl_dir"

    # Generate .htpasswd files using the auto-generated passwords
    # -cb: create file, use bcrypt, read password from command line
    run_sudo htpasswd -cb "$ssl_dir/.htpasswd_kafka" admin "$REDPANDA_CONSOLE_PASSWORD"
    run_sudo htpasswd -cb "$ssl_dir/.htpasswd_seq"   admin "$SEQ_CONSOLE_PASSWORD"
    run_sudo htpasswd -cb "$ssl_dir/.htpasswd_cdc"   admin "$CDC_CONSOLE_PASSWORD"

    # Secure permissions — readable by nginx (root), no world access
    run_sudo chmod 640 "$ssl_dir/.htpasswd_kafka" "$ssl_dir/.htpasswd_seq" "$ssl_dir/.htpasswd_cdc"

    print_success ".htpasswd files generated for Redpanda Console, Seq Logs, Debezium CDC"
}

# =============================================================================
# Generate EdgeRuntime .env file (pre-filled with real passwords)
# =============================================================================
# The EdgeRuntime runs on remote edge servers. This function generates a
# ready-to-use .env file that admins can scp to each edge site.
# =============================================================================

generate_edge_env() {
    print_step "Generating EdgeRuntime .env file with production credentials..."

    local server_ip=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    local edge_env="/opt/openradius/edge-runtime.env"
    local edge_postgres_pw=$(generate_password 32)
    local edge_clickhouse_pw=$(generate_password 32)
    local edge_nas_secret=$(generate_password 16)
    local edge_status_secret=$(generate_password 16)

    run_sudo tee "$edge_env" > /dev/null << EOF
# ============================================================================
# EdgeRuntime Environment — Generated by OpenRadius Installer
# Generated on: $(date)
# ============================================================================
# Copy this file to each edge site:
#   scp $edge_env user@edge-server:/opt/edge-runtime/.env
#
# Then adjust COMPOSE_PROJECT_NAME and EDGE_SITE_ID per site.
# ============================================================================

# --- Project Identity ---
COMPOSE_PROJECT_NAME=edge

# --- PostgreSQL (Edge Database) ---
POSTGRES_DB=edge_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$edge_postgres_pw
POSTGRES_PORT=5434

# --- Redis (Session & Auth Cache) ---
REDIS_MAX_MEMORY=512mb
REDIS_PORT=6380

# --- Kafka / Redpanda (Cloud CDC Source) ---
KAFKA_BOOTSTRAP_SERVERS=kafka.$DOMAIN:9094
KAFKA_HOST_IP=$server_ip

# --- Kafka SASL Authentication ---
KAFKA_SASL_USERNAME=admin
KAFKA_SASL_PASSWORD=$KAFKA_SASL_PASSWORD

# --- Kafka Connect (JDBC Sink) ---
CONNECTOR_GROUP_ID=2
CONNECTOR_MAX_TASKS=1
CONNECT_PORT=8084

# --- ClickHouse (Accounting Analytics) ---
CLICKHOUSE_DB=radius_analytics
CLICKHOUSE_USER=radius
CLICKHOUSE_PASSWORD=$edge_clickhouse_pw
CLICKHOUSE_HTTP_PORT=8123
CLICKHOUSE_NATIVE_PORT=9000

# --- Fluent Bit (Accounting Pipeline) ---
EDGE_SITE_ID=edge-1
FLUENT_BIT_METRICS_PORT=2020
LOG_LEVEL=info

# --- FreeRADIUS ---
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
RADIUS_STATUS_PORT=18120
RADIUS_STATUS_SECRET=$edge_status_secret
RADIUS_CMD=-fl
TZ=UTC

# --- NAS Security ---
NAS_SECRET=$edge_nas_secret
EOF

    run_sudo chmod 600 "$edge_env"

    # Also append edge-specific credentials to the main credentials file
    local creds_file=$(ls -t /opt/openradius/openradius-credentials-*.txt 2>/dev/null | head -1)
    if [[ -n "$creds_file" ]]; then
        run_sudo tee -a "$creds_file" > /dev/null << EOF

# =============================================================================
# EdgeRuntime Credentials (for remote edge sites)
# =============================================================================
EdgeRuntime .env file: $edge_env
  Copy to edge sites: scp $edge_env user@edge-server:/opt/edge-runtime/.env

Edge PostgreSQL:
  - Password: $edge_postgres_pw

Edge ClickHouse:
  - Password: $edge_clickhouse_pw

Edge FreeRADIUS:
  - NAS Secret: $edge_nas_secret
  - Status Secret: $edge_status_secret

Kafka SASL (same as cloud):
  - Username: admin
  - Password: $KAFKA_SASL_PASSWORD
EOF
    fi

    print_success "EdgeRuntime .env generated: $edge_env"
    print_info "Copy to edge sites: scp $edge_env user@edge-server:/opt/edge-runtime/.env"
}

# =============================================================================
# Pull Docker Images
# =============================================================================

pull_docker_images() {
    print_step "Pulling Docker images..."
    
    # Fix containerd content store corruption that can occur after volume removal.
    # The ingest directory may contain stale/broken entries that block all image pulls.
    # We must fully stop Docker+containerd, remove AND recreate the ingest dir, then restart.
    print_info "Cleaning containerd content store and restarting Docker..."
    systemctl stop docker docker.socket containerd 2>/dev/null || true
    sleep 2
    rm -rf /var/lib/containerd/io.containerd.content.v1.content/ingest 2>/dev/null || true
    mkdir -p /var/lib/containerd/io.containerd.content.v1.content/ingest
    systemctl start containerd
    sleep 2
    systemctl start docker
    sleep 5
    
    # Retry pull up to 3 times (network/storage transient failures)
    local max_retries=3
    local attempt=1
    while [ $attempt -le $max_retries ]; do
        if docker compose -f docker-compose.prod.yml pull 2>&1; then
            print_success "Docker images pulled successfully"
            return 0
        fi
        
        if [ $attempt -lt $max_retries ]; then
            print_warning "Image pull failed (attempt $attempt/$max_retries). Retrying in 10 seconds..."
            # Deep clean: stop everything, nuke containerd ingest dir, restart
            systemctl stop docker docker.socket containerd 2>/dev/null || true
            sleep 2
            rm -rf /var/lib/containerd/io.containerd.content.v1.content/ingest 2>/dev/null || true
            mkdir -p /var/lib/containerd/io.containerd.content.v1.content/ingest
            systemctl start containerd
            sleep 2
            systemctl start docker
            sleep 10
        fi
        attempt=$((attempt + 1))
    done
    
    print_error "Failed to pull Docker images after $max_retries attempts."
    print_info "Please check your internet connection and Docker daemon status."
    print_info "You can retry manually with: docker compose -f docker-compose.prod.yml pull"
    exit 60
}

# =============================================================================
# Start Services
# =============================================================================

start_services() {
    print_step "Starting OpenRadius services..."
    
    # Stop system nginx if it's running (Docker nginx will take over)
    if systemctl is-active --quiet nginx 2>/dev/null; then
        print_info "Stopping system nginx to free port 80/443 for Docker..."
        sudo systemctl stop nginx
        sudo systemctl disable nginx 2>/dev/null || true
    fi
    
    docker compose -f docker-compose.prod.yml up -d
    
    print_success "Services started"
}

# =============================================================================
# Health Checks
# =============================================================================

wait_for_services() {
    print_step "Waiting for services to be healthy..."
    
    local max_wait=600  # 10 minutes (increased from 5)
    local elapsed=0
    local interval=10
    
    # Services that must be healthy
    local required_services="postgres redis keycloak backend"
    
    while [ $elapsed -lt $max_wait ]; do
        local all_healthy=true
        local unhealthy_services=""
        
        # Check each required service
        for service in $required_services; do
            local status=$(docker compose -f docker-compose.prod.yml ps $service 2>/dev/null | grep -o "healthy\|unhealthy\|starting" | head -1)
            if [[ "$status" != "healthy" ]]; then
                all_healthy=false
                unhealthy_services="$unhealthy_services $service($status)"
            fi
        done
        
        if [ "$all_healthy" = true ]; then
            echo ""
            print_success "All critical services are healthy!"
            
            # Give nginx and frontend a bit more time to start
            print_info "Starting remaining services..."
            sleep 5
            return 0
        fi
        
        echo -ne "\r${YELLOW}Waiting for services... ${elapsed}s - Not ready:${unhealthy_services}${NC}                    "
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo ""
    print_warning "Timeout waiting for services. Checking status..."
    docker compose -f docker-compose.prod.yml ps
    print_info "You can check logs with: docker compose -f docker-compose.prod.yml logs -f"
}

# =============================================================================
# Configure Keycloak Realm and Clients
# =============================================================================

configure_keycloak() {
    if [[ "$CONFIGURE_KEYCLOAK" != "y" ]]; then
        print_step "Skipping Keycloak auto-configuration"
        return
    fi
    
    print_step "Configuring Keycloak realm and clients..."
    print_info "Waiting for Keycloak to be fully ready..."
    
    # Wait for Keycloak to be fully initialized
    sleep 15
    
    # Get admin token with retries
    print_info "Authenticating with Keycloak..."
    local max_retries=6
    local retry=0
    local auth_success=false
    while [ $retry -lt $max_retries ]; do
        if docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
            --server http://localhost:8080 \
            --realm master \
            --user admin \
            --password "$KEYCLOAK_ADMIN_PASSWORD" 2>/dev/null; then
            auth_success=true
            print_success "Authenticated with Keycloak"
            break
        fi
        retry=$((retry + 1))
        print_info "Waiting for Keycloak to be ready (attempt $retry/$max_retries)..."
        sleep 10
    done
    
    if [ "$auth_success" != "true" ]; then
        print_error "Failed to authenticate with Keycloak after $max_retries attempts"
        print_info "You may need to configure Keycloak manually"
        return 1
    fi
    
    # === Step 1: Import realm from JSON config (if available) ===
    local realm_exists=false
    
    # Check if realm already exists
    if docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get realms/openradius \
        --fields realm 2>/dev/null | grep -q "openradius"; then
        print_success "Realm 'openradius' already exists"
        realm_exists=true
    fi
    
    if [ "$realm_exists" != "true" ] && [ -f "/tmp/keycloak-import.json" ]; then
        print_info "Importing realm from keycloak-config.json..."
        
        # Step 1a: Clean the JSON to remove fields that conflict with built-in realm-management client
        # The REST API rejects attempts to define roles for built-in clients (realm-management)
        print_info "Cleaning JSON for REST API compatibility..."
        # Remove: realm-management client roles, client scope mappings, scope mappings, 
        # user clientRoles (assigned later via kcadm.sh), and keycloakVersion mismatch
        jq 'del(.roles.client, .clientScopeMappings, .scopeMappings, .keycloakVersion) |
            .users |= map(del(.clientRoles))' \
            /tmp/keycloak-import.json > /tmp/keycloak-import-clean.json 2>/dev/null
        
        if [ -f "/tmp/keycloak-import-clean.json" ] && [ -s "/tmp/keycloak-import-clean.json" ]; then
            # Copy cleaned config into container
            docker cp /tmp/keycloak-import-clean.json openradius-keycloak:/tmp/keycloak-import.json
            
            # Try kcadm.sh create realms with the cleaned JSON
            print_info "Creating realm via kcadm.sh create realms..."
            IMPORT_OUTPUT=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create realms \
                -f /tmp/keycloak-import.json 2>&1)
            IMPORT_EXIT=$?
            
            if [ $IMPORT_EXIT -eq 0 ]; then
                print_success "Realm imported successfully via kcadm.sh!"
                realm_exists=true
            else
                print_warning "kcadm.sh import failed (exit: $IMPORT_EXIT): $IMPORT_OUTPUT"
                
                # Step 1b: Try via Keycloak REST API partial-import as alternative
                print_info "Trying partial-import as alternative..."
                
                # Create bare realm first
                docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create realms \
                    -s realm=openradius -s enabled=true -s displayName="OpenRadius" 2>/dev/null
                
                # Use kcadm.sh partial-import with cleaned JSON + SKIP conflicts
                # (maps to POST /admin/realms/{realm}/partialImport)
                PARTIAL_OUTPUT=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create partialImport \
                    -r openradius -o \
                    -s ifResourceExists=SKIP \
                    -f /tmp/keycloak-import.json 2>&1)
                PARTIAL_EXIT=$?
                
                if [ $PARTIAL_EXIT -eq 0 ]; then
                    print_success "Realm configuration imported via partial-import!"
                    realm_exists=true
                else
                    print_warning "Partial import failed (exit: $PARTIAL_EXIT)"
                    print_info "Output: $(echo $PARTIAL_OUTPUT | head -c 500)"
                fi
            fi
        else
            print_warning "jq failed to clean JSON - falling back to manual creation"
        fi
        
        # Clean up temp files
        rm -f /tmp/keycloak-import.json /tmp/keycloak-import-clean.json
    fi
    
    # === Step 2: Manual realm creation (fallback) ===
    if [ "$realm_exists" != "true" ]; then
        print_info "Creating openradius realm manually..."
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create realms \
            -s realm=openradius \
            -s enabled=true \
            -s displayName="OpenRadius" \
            -s registrationAllowed=false \
            -s resetPasswordAllowed=true \
            -s loginWithEmailAllowed=true 2>&1 || print_error "Failed to create realm"
        
        # Create openradius-web client
        print_info "Creating openradius-web client..."
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create clients \
            -r openradius \
            -s clientId=openradius-web \
            -s name="OpenRadius Web Application" \
            -s enabled=true \
            -s publicClient=true \
            -s protocol=openid-connect \
            -s standardFlowEnabled=true \
            -s directAccessGrantsEnabled=true \
            -s 'redirectUris=["https://'$DOMAIN'/*","https://'$DOMAIN'"]' \
            -s 'webOrigins=["https://'$DOMAIN'"]' \
            -s baseUrl="https://$DOMAIN" \
            -s rootUrl="https://$DOMAIN" \
            -s 'attributes.pkce.code.challenge.method=S256' \
            -s 'attributes."post.logout.redirect.uris"=https://'$DOMAIN'/*' 2>&1 || print_warning "Client may already exist"
    fi
    
    # === Step 3: Post-import configuration (always runs) ===
    
    # Ensure openradius-admin client exists with service account
    print_info "Ensuring openradius-admin client is configured..."
    ADMIN_CLIENT_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get clients \
        -r openradius --fields id,clientId 2>/dev/null | grep -B1 '"clientId" : "openradius-admin"' | grep '"id"' | cut -d'"' -f4)
    
    if [ -z "$ADMIN_CLIENT_ID" ]; then
        print_info "Creating openradius-admin client with service account..."
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create clients \
            -r openradius \
            -s clientId=openradius-admin \
            -s name="OpenRadius Admin Client" \
            -s enabled=true \
            -s publicClient=false \
            -s standardFlowEnabled=false \
            -s directAccessGrantsEnabled=false \
            -s serviceAccountsEnabled=true \
            -s secret=openradius-admin-secret-2026 \
            -s 'attributes."access.token.lifespan"=3600' 2>&1 || print_warning "Failed to create openradius-admin client"
        
        # Wait for service account user to be auto-created
        sleep 5
        print_success "openradius-admin client created"
    else
        print_success "openradius-admin client already exists"
        
        # Ensure service accounts are enabled on existing client
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh update clients/$ADMIN_CLIENT_ID \
            -r openradius \
            -s serviceAccountsEnabled=true 2>/dev/null || true
    fi
    
    # Verify service account user exists (should be auto-created by Keycloak)
    print_info "Verifying service account user exists..."
    sleep 2
    SA_USER_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get users \
        -r openradius -q username=service-account-openradius-admin --fields id 2>/dev/null | grep '"id"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$SA_USER_ID" ]; then
        print_warning "Service account user not found. It should be auto-created. Retrying..."
        sleep 5
        SA_USER_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get users \
            -r openradius -q username=service-account-openradius-admin --fields id 2>/dev/null | grep '"id"' | head -1 | cut -d'"' -f4)
    fi
    
    if [ -n "$SA_USER_ID" ]; then
        print_success "Service account user found: $SA_USER_ID"
    else
        print_error "Service account user was not created automatically!"
        print_info "You may need to recreate the openradius-admin client from Keycloak UI"
    fi
    
    # Assign realm-management roles to service-account-openradius-admin
    print_info "Assigning realm-management roles to openradius-admin service account..."
    
    REALM_MGMT_CLIENT_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get clients \
        -r openradius --fields id,clientId 2>/dev/null | grep -B1 '"clientId" : "realm-management"' | grep '"id"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$REALM_MGMT_CLIENT_ID" ] && [ -n "$SA_USER_ID" ]; then
        print_info "realm-management client ID: $REALM_MGMT_CLIENT_ID"
        print_info "Service account user ID: $SA_USER_ID"
        
        # Get available client roles for realm-management
        AVAILABLE_ROLES=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get \
            users/$SA_USER_ID/role-mappings/clients/$REALM_MGMT_CLIENT_ID/available \
            -r openradius 2>/dev/null)
        
        # Assign each role individually with better error handling
        for role_name in "view-users" "query-users" "manage-users" "view-clients" "query-clients" "query-groups"; do
            print_info "  Assigning role: $role_name"
            
            # Get role details
            ROLE_JSON=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get \
                clients/$REALM_MGMT_CLIENT_ID/roles/$role_name \
                -r openradius 2>/dev/null)
            
            if [ -n "$ROLE_JSON" ]; then
                ROLE_ID=$(echo "$ROLE_JSON" | grep '"id"' | head -1 | cut -d'"' -f4)
                
                # Create role mapping using kcadm.sh add-roles command (more reliable)
                docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh add-roles \
                    -r openradius \
                    --uusername service-account-openradius-admin \
                    --cclientid realm-management \
                    --rolename "$role_name" 2>&1 | grep -v "already exists" || true
                
                print_success "    ✓ $role_name assigned"
            else
                print_warning "    ✗ Role $role_name not found"
            fi
        done
        
        # Verify role assignments
        print_info "Verifying role assignments..."
        ASSIGNED_ROLES=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get \
            users/$SA_USER_ID/role-mappings/clients/$REALM_MGMT_CLIENT_ID \
            -r openradius 2>/dev/null | grep '"name"' | cut -d'"' -f4)
        
        if [ -n "$ASSIGNED_ROLES" ]; then
            print_success "Service account roles assigned successfully:"
            echo "$ASSIGNED_ROLES" | while read -r role; do
                echo -e "  ${GREEN}✓${NC} $role"
            done
        else
            print_warning "Could not verify role assignments"
        fi
    else
        print_warning "Could not assign service account roles"
        print_warning "  realm-management client ID: ${REALM_MGMT_CLIENT_ID:-NOT FOUND}"
        print_warning "  service account user ID: ${SA_USER_ID:-NOT FOUND}"
        print_info "You will need to assign these roles manually from Keycloak UI:"
        print_info "  Admin Console → Users → service-account-openradius-admin → Role mapping"
        print_info "  Filter by clients → realm-management → Assign: view-users, query-users, manage-users"
    fi
    
    # Ensure openradius-api client exists
    print_info "Ensuring openradius-api client exists..."
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create clients \
        -r openradius \
        -s clientId=openradius-api \
        -s name="OpenRadius API" \
        -s enabled=true \
        -s publicClient=false \
        -s bearerOnly=true \
        -s standardFlowEnabled=false \
        -s directAccessGrantsEnabled=false \
        -s 'attributes.access.token.lifespan=3600' 2>/dev/null || true
    
    # Ensure groups exist
    print_info "Ensuring user groups exist..."
    for group_name in "Administrators" "Users" "Managers"; do
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create groups \
            -r openradius -s name="$group_name" 2>/dev/null || true
    done
    
    # Ensure roles exist
    print_info "Ensuring realm roles exist..."
    for role_name in "admin" "user" "manager"; do
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create roles \
            -r openradius -s name="$role_name" 2>/dev/null || true
    done
    
    # Create openradius manager user with auto-generated password
    print_info "Creating openradius manager user..."
    OPENRADIUS_USER_EXISTS=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get users \
        -r openradius -q username=openradius --fields username 2>/dev/null | grep -c '"username" : "openradius"' || true)
    
    if [ "$OPENRADIUS_USER_EXISTS" -eq 0 ] 2>/dev/null; then
        # Create user
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create users \
            -r openradius \
            -s username=openradius \
            -s enabled=true \
            -s emailVerified=true \
            -s firstName="OpenRadius" \
            -s lastName="Manager" \
            -s email="manager@$DOMAIN" 2>/dev/null || true
        
        # Set password
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh set-password \
            -r openradius \
            --username openradius \
            --new-password "$OPENRADIUS_USER_PASSWORD" 2>/dev/null || true
        
        # Get user ID
        OPENRADIUS_USER_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get users \
            -r openradius -q username=openradius --fields id 2>/dev/null | grep '"id"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$OPENRADIUS_USER_ID" ]; then
            # Assign roles
            docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh add-roles \
                -r openradius \
                --uid "$OPENRADIUS_USER_ID" \
                --rolename manager \
                --rolename user 2>/dev/null || true
            
            # Get Managers group ID
            MANAGERS_GROUP_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get groups \
                -r openradius --fields id,name 2>/dev/null | grep -B1 '"name" : "Managers"' | grep '"id"' | cut -d'"' -f4)
            
            if [ -n "$MANAGERS_GROUP_ID" ]; then
                # Add user to Managers group
                docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh update users/"$OPENRADIUS_USER_ID"/groups/"$MANAGERS_GROUP_ID" \
                    -r openradius -s realm=openradius -s userId="$OPENRADIUS_USER_ID" -s groupId="$MANAGERS_GROUP_ID" -n 2>/dev/null || true
            fi
            
            print_success "openradius user created successfully"
        else
            print_warning "Could not get openradius user ID"
        fi
    else
        print_success "openradius user already exists"
    fi
    
    # Verify 'sub' claim mapper in openid scope
    print_info "Verifying 'sub' claim mapper in openid scope..."
    OPENID_SCOPE_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get client-scopes \
        -r openradius --fields id,name 2>/dev/null | grep -B1 '"name" : "openid"' | grep '"id"' | cut -d'"' -f4)
    
    if [ -n "$OPENID_SCOPE_ID" ]; then
        SUB_MAPPER_EXISTS=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get \
            client-scopes/$OPENID_SCOPE_ID/protocol-mappers/models \
            -r openradius --fields name 2>/dev/null | grep -c '"User ID"\|"sub"' || true)
        
        if [ "$SUB_MAPPER_EXISTS" -eq 0 ] 2>/dev/null; then
            print_info "Adding 'sub' claim mapper..."
            docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create \
                client-scopes/$OPENID_SCOPE_ID/protocol-mappers/models \
                -r openradius \
                -s name="User ID" \
                -s protocol=openid-connect \
                -s protocolMapper=oidc-usermodel-property-mapper \
                -s 'config."user.attribute"=id' \
                -s 'config."claim.name"=sub' \
                -s 'config."id.token.claim"=true' \
                -s 'config."access.token.claim"=true' \
                -s 'config."userinfo.token.claim"=true' \
                -s 'config."jsonType.label"=String' 2>/dev/null || print_warning "Mapper may already exist"
        fi
        print_success "'sub' claim mapper verified"
    else
        print_warning "Could not find openid client scope - 'sub' claim may need manual setup"
    fi
    
    print_success "Keycloak realm and clients configured successfully!"
    print_info "You can now access Keycloak at: https://auth.$DOMAIN"
    print_info "Admin console: https://auth.$DOMAIN/admin"
}

# =============================================================================
# Setup Backup Script
# =============================================================================

setup_backup() {
    if [[ "$ENABLE_BACKUP" != "y" ]]; then
        return
    fi
    
    print_step "Setting up automated backups..."
    
    cat > backup-openradius.sh << 'EOF'
#!/bin/bash
# OpenRadius Backup Script

BACKUP_DIR="/opt/openradius-backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/openradius-backup-$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

# Backup database
docker compose -f /opt/openradius/docker-compose.prod.yml exec -T postgres \
    pg_dump -U openradius openradius | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Backup volumes
docker run --rm \
    -v openradius-postgres-data:/data \
    -v $BACKUP_DIR:/backup \
    alpine tar czf /backup/volumes-$DATE.tar.gz /data

# Backup configuration
tar czf "$BACKUP_DIR/config-$DATE.tar.gz" \
    /opt/openradius/.env \
    /opt/openradius/docker-compose.prod.yml \
    /opt/openradius/nginx/

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
EOF
    
    chmod +x backup-openradius.sh
    
    # Add to crontab (daily at 2 AM)
    echo "0 2 * * * root /opt/openradius/backup-openradius.sh" | sudo tee -a /etc/crontab
    
    print_success "Automated backups configured (daily at 2 AM)"
}

# =============================================================================
# Post-Installation Summary
# =============================================================================

show_summary() {
    print_header "INSTALLATION COMPLETE!"
    
    echo -e "${GREEN}OpenRadius v${OPENRADIUS_VERSION} has been successfully installed!${NC}\n"
    
    echo -e "${CYAN}Service URLs:${NC}"
    echo -e "  Main App:        ${GREEN}https://$DOMAIN${NC}"
    echo -e "  API:             ${GREEN}https://api.$DOMAIN${NC}"
    echo -e "  Keycloak:        ${GREEN}https://auth.$DOMAIN${NC}"
    echo -e "  Seq Logs:        ${GREEN}https://logs.$DOMAIN${NC}"
    echo -e "  Kafka Console:   ${GREEN}https://kafka.$DOMAIN${NC}"
    echo -e "  Kafka Broker:    ${GREEN}kafka.$DOMAIN:9094${NC}"
    echo -e "  Debezium:        ${GREEN}https://cdc.$DOMAIN${NC}"
    echo ""
    
    echo -e "${CYAN}Keycloak Admin:${NC}"
    echo -e "  URL:      ${GREEN}https://auth.$DOMAIN/admin${NC}"
    echo -e "  Username: ${GREEN}admin${NC}"
    echo -e "  Password: ${YELLOW}$KEYCLOAK_ADMIN_PASSWORD${NC}"
    echo ""
    
    echo -e "${CYAN}OpenRadius Manager User:${NC}"
    echo -e "  URL:      ${GREEN}https://$DOMAIN${NC}"
    echo -e "  Username: ${GREEN}openradius${NC}"
    echo -e "  Password: ${YELLOW}$OPENRADIUS_USER_PASSWORD${NC}"
    echo ""
    
    echo -e "${CYAN}Admin Consoles (Nginx Basic Auth):${NC}"
    echo -e "  Redpanda Console:  ${GREEN}https://kafka.$DOMAIN${NC}"
    echo -e "    Username: ${GREEN}admin${NC}   Password: ${YELLOW}$REDPANDA_CONSOLE_PASSWORD${NC}"
    echo -e "  Seq Logs:          ${GREEN}https://logs.$DOMAIN${NC}"
    echo -e "    Username: ${GREEN}admin${NC}   Password: ${YELLOW}$SEQ_CONSOLE_PASSWORD${NC}"
    echo -e "  Debezium CDC:      ${GREEN}https://cdc.$DOMAIN${NC}"
    echo -e "    Username: ${GREEN}admin${NC}   Password: ${YELLOW}$CDC_CONSOLE_PASSWORD${NC}"
    echo ""

    echo -e "${CYAN}Kafka Broker (SASL/SCRAM):${NC}"
    echo -e "  Broker:    ${GREEN}kafka.$DOMAIN:9094${NC}"
    echo -e "  Username:  ${GREEN}admin${NC}"
    echo -e "  Password:  ${YELLOW}$KAFKA_SASL_PASSWORD${NC}"
    echo -e "  Mechanism: ${GREEN}SCRAM-SHA-256${NC}"
    echo ""

    echo -e "${CYAN}EdgeRuntime (for edge sites):${NC}"
    echo -e "  Pre-configured .env:  ${GREEN}/opt/openradius/edge-runtime.env${NC}"
    echo -e "  Copy to edge sites:   ${YELLOW}scp /opt/openradius/edge-runtime.env user@edge-server:/opt/edge-runtime/.env${NC}"
    echo -e "  ${YELLOW}⚠ Adjust COMPOSE_PROJECT_NAME and EDGE_SITE_ID per site${NC}"
    echo ""

    echo -e "${CYAN}Useful Commands:${NC}"
    echo -e "  View logs:       ${YELLOW}docker compose -f docker-compose.prod.yml logs -f${NC}"
    echo -e "  Check status:    ${YELLOW}docker compose -f docker-compose.prod.yml ps${NC}"
    echo -e "  Restart:         ${YELLOW}docker compose -f docker-compose.prod.yml restart${NC}"
    echo -e "  Stop:            ${YELLOW}docker compose -f docker-compose.prod.yml down${NC}"
    echo -e "  Update:          ${YELLOW}docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d${NC}"
    echo ""
    
    echo -e "${CYAN}View Logs by Service:${NC}"
    echo -e "  All services:    ${YELLOW}docker compose -f docker-compose.prod.yml logs -f${NC}"
    echo -e "  Backend:         ${YELLOW}docker logs openradius-backend -f${NC}"
    echo -e "  Frontend:        ${YELLOW}docker logs openradius-frontend -f${NC}"
    echo -e "  Nginx:           ${YELLOW}docker logs openradius-nginx -f${NC}"
    echo -e "  PostgreSQL:      ${YELLOW}docker logs openradius-postgres -f${NC}"
    echo -e "  Keycloak:        ${YELLOW}docker logs openradius-keycloak -f${NC}"
    echo -e "  Redis:           ${YELLOW}docker logs openradius-redis -f${NC}"
    echo -e "  Redpanda:        ${YELLOW}docker logs openradius-redpanda -f${NC}"
    echo -e "  Debezium:        ${YELLOW}docker logs openradius-debezium -f${NC}"
    echo -e "  Seq:             ${YELLOW}docker logs openradius-seq -f${NC}"
    echo ""
    
    echo -e "${CYAN}Troubleshooting:${NC}"
    echo -e "  Last 100 lines:  ${YELLOW}docker logs openradius-<service> --tail 100${NC}"
    echo -e "  Search errors:   ${YELLOW}docker logs openradius-<service> 2>&1 | grep -i error${NC}"
    echo -e "  Check health:    ${YELLOW}docker inspect openradius-<service> | jq '.[0].State.Health'${NC}"
    echo -e "  Enter container: ${YELLOW}docker exec -it openradius-<service> /bin/bash${NC}"
    echo ""
    
    if [[ "$ENABLE_BACKUP" == "y" ]]; then
        echo -e "${CYAN}Backups:${NC}"
        echo -e "  Location:        ${GREEN}/opt/openradius-backups${NC}"
        echo -e "  Schedule:        ${GREEN}Daily at 2:00 AM${NC}"
        echo -e "  Manual backup:   ${YELLOW}./backup-openradius.sh${NC}"
        echo ""
    fi
    
    echo -e "${YELLOW}Next Steps:${NC}"
    if [[ "$CONFIGURE_KEYCLOAK" == "y" ]]; then
        echo -e "  1. Access Keycloak admin console (already configured)"
        echo -e "  2. Create initial users via Keycloak admin UI"
        echo -e "  3. Test all service URLs"
        echo -e "  4. Configure monitoring and alerting"
    else
        echo -e "  1. Access Keycloak admin console"
        echo -e "  2. Configure OpenRadius realm and clients"
        echo -e "  3. Set up initial users and permissions"
        echo -e "  4. Test all service URLs"
        echo -e "  5. Configure monitoring and alerting"
    fi
    echo ""
    
    echo -e "${CYAN}⚠️  IMPORTANT: Configure 'sub' Claim Mapper${NC}"
    echo -e "${YELLOW}If you encounter 'Missing required sub claim' errors:${NC}"
    echo ""
    echo -e "  1. Go to: ${GREEN}https://auth.$DOMAIN/admin${NC}"
    echo -e "  2. Navigate: ${CYAN}Clients → openradius-web → Client scopes${NC}"
    echo -e "  3. Click on: ${CYAN}openid${NC} (in Assigned default client scopes)"
    echo -e "  4. Go to: ${CYAN}Mappers tab${NC}"
    echo -e "  5. Check if ${YELLOW}'sub'${NC} mapper exists"
    echo -e "  6. If NOT, click: ${CYAN}Add mapper → By configuration → User Property${NC}"
    echo -e "     - Name: ${GREEN}sub${NC}"
    echo -e "     - Property: ${GREEN}id${NC}"
    echo -e "     - Token Claim Name: ${GREEN}sub${NC}"
    echo -e "     - Claim JSON Type: ${GREEN}String${NC}"
    echo -e "     - ✅ Add to ID token"
    echo -e "     - ✅ Add to access token"
    echo -e "     - ✅ Add to userinfo"
    echo -e "  7. Click: ${CYAN}Save${NC}"
    echo -e "  8. ${YELLOW}Logout and login again${NC} to get new tokens"
    echo ""
    echo -e "  ${CYAN}📖 Full guide: ${GREEN}KEYCLOAK_SUB_CLAIM_FIX.md${NC}"
    echo ""
    
    local creds_pattern="/opt/openradius/openradius-credentials-*.txt"
    local creds_path=$(ls -t $creds_pattern 2>/dev/null | head -1)
    if [[ -n "$creds_path" ]]; then
        echo -e "${CYAN}Credentials File:${NC}"
        echo -e "  All passwords saved to: ${GREEN}$creds_path${NC}"
        echo -e "  View with: ${YELLOW}sudo cat $creds_path${NC}"
        echo ""
    fi
    print_warning "IMPORTANT: Securely store the credentials file and delete it from the server!"
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}                ✨ OpenRadius v${OPENRADIUS_VERSION} — Installation Successful! ✨${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${PURPLE}                         Powered By${NC}"
    echo -e "${PURPLE}                    Ali Al-Estarbadee${NC}"
    echo -e "${CYAN}                 📧 ali87mohammed@hotmail.com${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# =============================================================================
# Check Existing Installation
# =============================================================================

check_existing_installation() {
    local has_installation=false
    
    # Check if docker-compose.prod.yml exists
    if [[ -f "/opt/openradius/docker-compose.prod.yml" ]]; then
        has_installation=true
    fi
    
    # Check if OpenRadius containers are running
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "openradius-"; then
        has_installation=true
    fi
    
    # Check if OpenRadius volumes exist
    if docker volume ls --format '{{.Name}}' 2>/dev/null | grep -q "openradius_"; then
        has_installation=true
    fi
    
    if [[ "$has_installation" == "true" ]]; then
        print_warning "Existing OpenRadius installation detected!"
        echo ""
        echo -e "${YELLOW}Found existing installation components:${NC}"
        
        if [[ -f "/opt/openradius/docker-compose.prod.yml" ]]; then
            echo "  • Configuration files in /opt/openradius"
        fi
        
        if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "openradius-"; then
            echo "  • Running or stopped containers"
            docker ps -a --format '  - {{.Names}} ({{.Status}})' | grep openradius-
        fi
        
        if docker volume ls --format '{{.Name}}' 2>/dev/null | grep -q "openradius_"; then
            echo "  • Docker volumes with data"
            docker volume ls --format '  - {{.Name}}' | grep openradius_
        fi
        
        echo ""
        echo -e "${RED}⚠️  WARNING: Continuing will DELETE ALL existing data! ⚠️${NC}"
        echo -e "${RED}This includes:${NC}"
        echo -e "${RED}  • All database data${NC}"
        echo -e "${RED}  • All user accounts${NC}"
        echo -e "${RED}  • All configuration${NC}"
        echo -e "${RED}  • All logs${NC}"
        echo ""

        # In unattended mode, auto-confirm removal (the user opted for a fresh install)
        if [[ "$UNATTENDED" == "true" ]]; then
            print_warning "Unattended mode: auto-confirming removal of existing installation"
            log "[UNATTENDED] Auto-confirming removal of existing installation"
            remove_confirm="y"
        else
            echo -e "${YELLOW}Do you want to remove the existing installation and start fresh? [y/N]: ${NC}"
            read -p "> " remove_confirm
            remove_confirm=${remove_confirm,,}  # Convert to lowercase
        fi
        
        if [[ "$remove_confirm" != "y" ]]; then
            print_error "Installation cancelled. Existing installation preserved."
            echo ""
            echo -e "${CYAN}To manually remove the existing installation, run:${NC}"
            echo "  cd /opt/openradius"
            echo "  docker compose -f docker-compose.prod.yml down -v"
            echo "  cd / && rm -rf /opt/openradius"
            echo "  docker system prune -a --volumes -f"
            exit 0
        fi
        
        print_step "Removing existing installation..."
        
        # Stop and remove containers
        if [[ -f "/opt/openradius/docker-compose.prod.yml" ]]; then
            cd /opt/openradius
            docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
        fi
        
        # Remove any remaining containers
        docker ps -a --format '{{.Names}}' 2>/dev/null | grep "openradius-" | xargs -r docker rm -f 2>/dev/null || true
        
        # Remove volumes
        docker volume ls --format '{{.Name}}' 2>/dev/null | grep "openradius_" | xargs -r docker volume rm -f 2>/dev/null || true
        
        # Remove installation directory
        run_sudo rm -rf /opt/openradius
        
        # Clean up dangling images
        docker image prune -f 2>/dev/null || true
        
        print_success "Existing installation removed successfully"
        echo ""
        sleep 2
    fi
}

# =============================================================================
# Main Installation Flow
# =============================================================================

main() {
    # Auto-elevate to root if not running as root
    if [[ $EUID -ne 0 ]]; then
        print_warning "This script requires root privileges."
        print_info "Re-running with sudo..."
        exec sudo bash "$0" "$@"
        exit $?
    fi
    
    clear
    
    # ASCII Art Banner
    echo -e "${PURPLE}"
    cat << "EOF"
   ____                   _____           _ _           
  / __ \                 |  __ \         | (_)          
 | |  | |_ __   ___ _ __ | |__) |__ _  __| |_ _   _ ___ 
 | |  | | '_ \ / _ \ '_ \|  _  // _` |/ _` | | | | / __|
 | |__| | |_) |  __/ | | | | \ \ (_| | (_| | | |_| \__ \
  \____/| .__/ \___|_| |_|_|  \_\__,_|\__,_|_|\__,_|___/
        | |                                              
        |_|                                              
EOF
    echo -e "${NC}"
    echo -e "${CYAN}                         Version ${GREEN}${OPENRADIUS_VERSION}${NC}"
    echo ""
    
    print_header "OpenRadius Enterprise Installation v${OPENRADIUS_VERSION}"
    
    echo -e "${CYAN}This script will install and configure:${NC}"
    echo "  • Docker & Docker Compose"
    echo "  • OpenRadius with all services"
    echo "  • Nginx reverse proxy"
    echo "  • SSL certificates (Let's Encrypt)"
    echo "  • Firewall configuration"
    echo "  • Automated backups (optional)"
    echo ""
    
    echo -e "${YELLOW}Do you want to continue? [y/N]: ${NC}"
    read -p "> " confirm
    confirm=${confirm,,}  # Convert to lowercase
    if [[ "$confirm" != "y" ]]; then
        print_error "Installation cancelled"
        exit 0
    fi
    
    # Pre-installation checks
    check_root
    check_sudo
    check_ubuntu
    
    # Check for existing installation
    check_existing_installation
    
    # Install dependencies
    install_docker
    install_docker_compose
    install_prerequisites
    
    # Configure system
    configure_firewall
    
    # Collect configuration
    collect_configuration
    
    # Generate configuration files
    generate_env_file
    save_credentials
    
    # DNS and SSL
    show_dns_instructions
    generate_ssl_certificates
    
    # Clone repository and deploy
    clone_repository
    configure_nginx
    generate_htpasswd_files
    generate_edge_env
    prepare_keycloak_import
    pull_docker_images
    start_services
    wait_for_services
    
    # Configure Keycloak
    configure_keycloak
    
    # Post-installation
    setup_backup
    
    # Show summary
    show_summary
    
    print_success "Installation script completed!"
}

# Run main function
main
