#!/bin/sh
# =============================================================================
# OpenRadius Frontend - Runtime Configuration Injection
# =============================================================================
# Generates env-config.js at container startup based on DOMAIN env var
# This allows the same Docker image to work with any domain without rebuilding
# =============================================================================

CONFIG_FILE="/usr/share/nginx/html/env-config.js"

# If DOMAIN is set, generate runtime config based on it
if [ -n "$DOMAIN" ]; then
  echo "Generating runtime config for domain: $DOMAIN"
  cat > "$CONFIG_FILE" <<EOF
// Runtime configuration - generated at container startup
// Domain: ${DOMAIN} | Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: "https://api.${DOMAIN}",
  VITE_KEYCLOAK_URL: "https://auth.${DOMAIN}",
  VITE_KEYCLOAK_REALM: "openradius",
  VITE_KEYCLOAK_CLIENT_ID: "openradius-web",
  VITE_FRONTEND_URL: "https://${DOMAIN}",
  VITE_SEQ_URL: "https://logs.${DOMAIN}"
};
EOF
  echo "Runtime config written to $CONFIG_FILE"
else
  # No DOMAIN set - create empty config (will use build-time VITE_* or defaults)
  echo "No DOMAIN env var set - using build-time configuration"
  cat > "$CONFIG_FILE" <<EOF
// No runtime config - using build-time environment variables
window.__RUNTIME_CONFIG__ = {};
EOF
fi

# Start nginx
exec nginx -g "daemon off;"
