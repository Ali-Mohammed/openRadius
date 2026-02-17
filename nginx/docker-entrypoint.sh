#!/bin/sh
# =============================================================================
# Nginx Docker Entrypoint — OpenRadius
# =============================================================================
# Creates placeholder .htpasswd files if they don't exist.
# Without these files, auth_basic_user_file causes a hard 500 error.
# =============================================================================

SSL_DIR="/etc/nginx/ssl"

# Ensure the ssl directory exists (may be an empty mount)
mkdir -p "$SSL_DIR" 2>/dev/null || true

# Generate placeholder htpasswd files if missing
# These use a random password that nobody knows — forces admin to run
# the real generate-htpasswd.sh script before they can log in.
for file in .htpasswd_kafka .htpasswd_seq .htpasswd_cdc; do
    if [ ! -f "$SSL_DIR/$file" ]; then
        echo "⚠ WARNING: $SSL_DIR/$file not found — creating placeholder (run generate-htpasswd.sh!)"
        # htpasswd isn't available in nginx:alpine, so create a manual entry
        # Format: user:{SSHA}hash — use a nonce that can never be guessed
        NONCE=$(head -c 32 /dev/urandom | base64 | tr -d '=+/' | head -c 32)
        # apr1 format: user:$apr1$salt$hash — we use a dummy that can't match
        echo "admin:\$apr1\$placeholder\$$(head -c 16 /dev/urandom | base64 | tr -d '=+/' | head -c 22)" > "$SSL_DIR/$file"
        chmod 640 "$SSL_DIR/$file" 2>/dev/null || true
    fi
done

# Execute the original nginx entrypoint
exec /docker-entrypoint.sh "$@"
