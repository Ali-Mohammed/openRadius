#!/bin/sh
set -eu

# =============================================================================
# OpenRadius Frontend — Runtime Configuration Entrypoint
# =============================================================================
# Generates /usr/share/nginx/html/env-config.js at container startup so the
# same Docker image works with ANY domain without rebuilding.
#
# Resolution order in the browser:
#   1. window.__RUNTIME_CONFIG__  (this file, generated from DOMAIN env var)
#   2. import.meta.env.VITE_*    (baked at build time from .env.production)
#   3. Hardcoded localhost defaults in app.config.ts
#
# Usage:
#   docker run -e DOMAIN=example.com openradius-frontend
# =============================================================================

CONFIG_FILE="/usr/share/nginx/html/env-config.js"

log() { echo "[entrypoint] $*"; }

# ---------------------------------------------------------------------------
# Validate domain format (RFC 1123)
# ---------------------------------------------------------------------------
validate_domain() {
  echo "$1" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
}

# ---------------------------------------------------------------------------
# Generate runtime config
# ---------------------------------------------------------------------------
if [ -n "${DOMAIN:-}" ]; then

  if ! validate_domain "$DOMAIN"; then
    log "ERROR: Invalid domain format: '$DOMAIN'"
    log "Expected format: example.com or sub.example.com"
    exit 1
  fi

  log "Generating runtime config for domain: $DOMAIN"

  cat > "$CONFIG_FILE" <<EOF
// =============================================================================
// OpenRadius Runtime Configuration
// Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ") | Domain: ${DOMAIN}
// DO NOT EDIT — this file is regenerated on every container start
// =============================================================================
window.__RUNTIME_CONFIG__ = Object.freeze({
  VITE_API_URL:            "https://api.${DOMAIN}",
  VITE_KEYCLOAK_URL:       "https://auth.${DOMAIN}",
  VITE_KEYCLOAK_REALM:     "openradius",
  VITE_KEYCLOAK_CLIENT_ID: "openradius-web",
  VITE_FRONTEND_URL:       "https://${DOMAIN}",
  VITE_SEQ_URL:            "https://logs.${DOMAIN}"
});
EOF

  log "Runtime config written to $CONFIG_FILE"

else
  log "No DOMAIN env var set — using build-time configuration"

  cat > "$CONFIG_FILE" <<EOF
// No runtime override — build-time .env.production values are used
window.__RUNTIME_CONFIG__ = Object.freeze({});
EOF
fi

# ---------------------------------------------------------------------------
# Start nginx (exec replaces shell so PID 1 = nginx for proper signal handling)
# ---------------------------------------------------------------------------
log "Starting nginx..."
exec nginx -g "daemon off;"
