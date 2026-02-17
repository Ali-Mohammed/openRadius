#!/usr/bin/env bash
# =============================================================================
# generate-htpasswd.sh — Generate .htpasswd files for Nginx Basic Auth
# =============================================================================
# Secures: Redpanda Console, Debezium CDC API, Seq Logs
#
# Usage:
#   ./scripts/generate-htpasswd.sh
#
# Reads passwords from .env file or prompts interactively.
# Generates files in nginx/ssl/ directory.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------------------------------------------------------------------------
# Check dependencies
# ---------------------------------------------------------------------------
if ! command -v htpasswd &>/dev/null; then
    # Try installing
    if command -v apt-get &>/dev/null; then
        warn "htpasswd not found — installing apache2-utils..."
        sudo apt-get update -qq && sudo apt-get install -y -qq apache2-utils
    elif command -v brew &>/dev/null; then
        warn "htpasswd not found — installing httpd (macOS)..."
        brew install httpd
    else
        error "htpasswd not found. Install apache2-utils (Debian/Ubuntu) or httpd (macOS)."
    fi
fi

# ---------------------------------------------------------------------------
# Load .env if it exists
# ---------------------------------------------------------------------------
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
    info "Loading passwords from .env file..."
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

# ---------------------------------------------------------------------------
# Read or prompt for passwords
# ---------------------------------------------------------------------------
prompt_password() {
    local var_name="$1"
    local service="$2"
    local current="${!var_name:-}"

    if [[ -n "$current" && "$current" != "CHANGE_THIS_SECURE_PASSWORD" ]]; then
        info "Using $service password from .env"
        echo "$current"
    else
        warn "No password set for $service in .env"
        read -rsp "  Enter password for $service (admin user): " pw
        echo >&2
        if [[ -z "$pw" ]]; then
            error "Password cannot be empty for $service"
        fi
        echo "$pw"
    fi
}

KAFKA_PW=$(prompt_password "REDPANDA_CONSOLE_PASSWORD" "Redpanda Console")
SEQ_PW=$(prompt_password "SEQ_CONSOLE_PASSWORD" "Seq Logs")
CDC_PW=$(prompt_password "CDC_CONSOLE_PASSWORD" "Debezium CDC API")

# ---------------------------------------------------------------------------
# Create nginx/ssl directory if needed
# ---------------------------------------------------------------------------
if [[ ! -d "$SSL_DIR" ]]; then
    warn "Creating $SSL_DIR directory..."
    mkdir -p "$SSL_DIR"
fi

# ---------------------------------------------------------------------------
# Generate .htpasswd files
# ---------------------------------------------------------------------------
info "Generating .htpasswd_kafka  (Redpanda Console)..."
htpasswd -cb "$SSL_DIR/.htpasswd_kafka" admin "$KAFKA_PW"

info "Generating .htpasswd_seq    (Seq Logs)..."
htpasswd -cb "$SSL_DIR/.htpasswd_seq" admin "$SEQ_PW"

info "Generating .htpasswd_cdc    (Debezium CDC API)..."
htpasswd -cb "$SSL_DIR/.htpasswd_cdc" admin "$CDC_PW"

# ---------------------------------------------------------------------------
# Set permissions (644 so nginx worker process can read them)
# ---------------------------------------------------------------------------
chmod 644 "$SSL_DIR/.htpasswd_kafka" "$SSL_DIR/.htpasswd_seq" "$SSL_DIR/.htpasswd_cdc"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
info "✅ All .htpasswd files generated successfully!"
echo ""
echo "  Files created:"
echo "    $SSL_DIR/.htpasswd_kafka   → kafka.open-radius.org  (Redpanda Console)"
echo "    $SSL_DIR/.htpasswd_seq     → logs.open-radius.org   (Seq Logs)"
echo "    $SSL_DIR/.htpasswd_cdc     → cdc.open-radius.org    (Debezium CDC API)"
echo ""
echo "  Default username: admin"
echo ""
echo "  To add more users:"
echo "    htpasswd $SSL_DIR/.htpasswd_kafka  another_user"
echo "    htpasswd $SSL_DIR/.htpasswd_seq    another_user"
echo "    htpasswd $SSL_DIR/.htpasswd_cdc    another_user"
echo ""
echo "  Restart nginx to apply:"
echo "    docker compose -f docker-compose.prod.yml restart nginx"
echo ""
