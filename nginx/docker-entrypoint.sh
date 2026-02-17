#!/bin/sh
# =============================================================================
# Nginx Docker Entrypoint — OpenRadius
# =============================================================================
# Creates placeholder SSL certs and .htpasswd files if they don't exist.
# Without SSL certs, nginx refuses to start on HTTPS listeners.
# Without .htpasswd files, auth_basic_user_file causes a hard 500 error.
# =============================================================================

SSL_DIR="/etc/nginx/ssl"

# Ensure the ssl directory exists (may be an empty mount)
mkdir -p "$SSL_DIR" 2>/dev/null || true

# ── Self-signed SSL certs (placeholder until Let's Encrypt runs) ────────────
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
    echo "⚠ WARNING: SSL certificates not found — generating self-signed placeholder"
    echo "  Run certbot or the install script to get real Let's Encrypt certificates."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=OpenRadius/CN=localhost" \
        2>/dev/null
    chmod 644 "$SSL_DIR/fullchain.pem" 2>/dev/null || true
    chmod 600 "$SSL_DIR/privkey.pem" 2>/dev/null || true
fi

# ── .htpasswd files (placeholder until generate-htpasswd.sh runs) ───────────
for file in .htpasswd_kafka .htpasswd_seq .htpasswd_cdc; do
    if [ ! -f "$SSL_DIR/$file" ]; then
        echo "⚠ WARNING: $SSL_DIR/$file not found — creating placeholder (run generate-htpasswd.sh!)"
        # apr1 format placeholder that can never be guessed
        echo "admin:\$apr1\$placeholder\$$(head -c 16 /dev/urandom | base64 | tr -d '=+/' | head -c 22)" > "$SSL_DIR/$file"
    fi
    # Ensure nginx worker (non-root) can read htpasswd files
    chmod 644 "$SSL_DIR/$file" 2>/dev/null || true
done

# Execute the original nginx entrypoint
exec /docker-entrypoint.sh "$@"
