#!/bin/bash

# =============================================================================
# OpenRadius Enterprise Installation Script
# =============================================================================
# This script installs Docker, Docker Compose, and sets up OpenRadius
# with nginx reverse proxy for production deployment on Ubuntu.
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "\n${PURPLE}================================================================================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================================================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_step() {
    echo -e "${BLUE}➜ $1${NC}"
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
        exit 1
    fi
    print_success "Sudo access confirmed"
}

# Check Ubuntu version
check_ubuntu() {
    if [[ ! -f /etc/os-release ]]; then
        print_error "Cannot detect OS. This script is designed for Ubuntu."
        exit 1
    fi
    
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        print_error "This script is designed for Ubuntu. Detected: $ID"
        exit 1
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
    
    print_success "Firewall configured (ports 22, 80, 443 open)"
}

# =============================================================================
# Collect Configuration
# =============================================================================

collect_configuration() {
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
    else
        # Auto-generate passwords
        print_step "Generating secure passwords..."
        POSTGRES_PASSWORD=$(generate_password 32)
        KEYCLOAK_ADMIN_PASSWORD=$(generate_password 32)
        REDIS_PASSWORD=$(generate_password 32)
        SEQ_API_KEY=$(generate_password 32)
        SWITCH_DECRYPTION_KEY=$(generate_hex_key)
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

Redis:
  - Password: $REDIS_PASSWORD

Seq:
  - URL: https://logs.$DOMAIN
  - API Key: $SEQ_API_KEY

Switch Decryption Key: $SWITCH_DECRYPTION_KEY

# =============================================================================
# Service URLs
# =============================================================================
Main Application: https://$DOMAIN
API: https://api.$DOMAIN
Keycloak: https://auth.$DOMAIN
Seq Logs: https://logs.$DOMAIN
Kafka Console: https://kafka.$DOMAIN
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
        exit 1
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
        exit 1
    }
    
    print_success "Repository cloned to $install_dir"
}

# =============================================================================
# Pull Docker Images
# =============================================================================

pull_docker_images() {
    print_step "Pulling Docker images..."
    
    docker compose -f docker-compose.prod.yml pull
    
    print_success "Docker images pulled successfully"
}

# =============================================================================
# Start Services
# =============================================================================

start_services() {
    print_step "Starting OpenRadius services..."
    
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
    
    # Wait a bit more for Keycloak to be fully initialized
    sleep 10
    
    # Get admin token
    print_info "Authenticating with Keycloak..."
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
        --server http://localhost:8080 \
        --realm master \
        --user admin \
        --password "$KEYCLOAK_ADMIN_PASSWORD" 2>&1 | grep -v "Logging into" || true
    
    # Check if keycloak-config.json exists and import it
    if [ -f "/opt/openradius/keycloak/keycloak-config.json" ]; then
        print_info "Importing Keycloak configuration from keycloak-config.json..."
        
        # Update the config file with production domain before importing
        print_info "Updating configuration with production domain..."
        sed -i "s|http://localhost:5173|https://$DOMAIN|g" /opt/openradius/keycloak/keycloak-config.json
        
        # Copy config file to container
        docker cp /opt/openradius/keycloak/keycloak-config.json openradius-keycloak:/tmp/keycloak-config.json
        
        # Import the realm configuration
        print_info "Importing openradius realm..."
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create realms \
            -f /tmp/keycloak-config.json 2>/dev/null || print_warning "Realm may already exist, updating instead..."
        
        # If realm exists, update it
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh update realms/openradius \
            -f /tmp/keycloak-config.json 2>/dev/null || true
        
        print_success "Keycloak configuration imported from keycloak-config.json"
    else
        print_warning "keycloak-config.json not found, creating minimal configuration..."
        
        # Fallback to manual creation if config file doesn't exist
        -s clientId=openradius-web \
        -s name="OpenRadius Web Application" \
        -s description="OpenRadius frontend application using OIDC" \
        -s enabled=true \
        -s publicClient=true \
        -s protocol=openid-connect \
        -s standardFlowEnabled=true \
        -s implicitFlowEnabled=false \
        -s directAccessGrantsEnabled=true \
        -s serviceAccountsEnabled=false \
        -s authorizationServicesEnabled=false \
        -s 'redirectUris=["https://'$DOMAIN'/*","https://'$DOMAIN'"]' \
        -s 'webOrigins=["https://'$DOMAIN'"]' \
        -s baseUrl="https://$DOMAIN" \
        -s rootUrl="https://$DOMAIN" \
        -s adminUrl="https://$DOMAIN" \
        -s 'attributes.pkce.code.challenge.method=S256' \
        -s 'attributes."post.logout.redirect.uris"=https://'$DOMAIN'/*' 2>/dev/null || print_warning "Client may already exist"
    
    # Add protocol mappers to openradius-web client
    print_info "Adding protocol mappers to openradius-web client..."
    WEB_CLIENT_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get clients \
        -r openradius --fields id,clientId 2>/dev/null | grep -B1 '"clientId" : "openradius-web"' | grep '"id"' | cut -d'"' -f4)
    
    if [ -n "$WEB_CLIENT_ID" ]; then
        # Add groups mapper
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create \
            clients/$WEB_CLIENT_ID/protocol-mappers/models \
            -r openradius \
            -s name="groups" \
            -s protocol=openid-connect \
            -s protocolMapper=oidc-group-membership-mapper \
            -s 'config."full.path"=false' \
            -s 'config."id.token.claim"=true' \
            -s 'config."access.token.claim"=true' \
            -s 'config."claim.name"=groups' \
            -s 'config."userinfo.token.claim"=true' 2>/dev/null || print_warning "Groups mapper may already exist"
        
        # Add picture mapper
        docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create \
            clients/$WEB_CLIENT_ID/protocol-mappers/models \
            -r openradius \
            -s name="picture" \
            -s protocol=openid-connect \
            -s protocolMapper=oidc-usermodel-attribute-mapper \
            -s 'config."user.attribute"=picture' \
            -s 'config."id.token.claim"=true' \
            -s 'config."access.token.claim"=true' \
            -s 'config."claim.name"=picture' \
            -s 'config."userinfo.token.claim"=true' \
            -s 'config."jsonType.label"=String' 2>/dev/null || print_warning "Picture mapper may already exist"
        
        print_success "Protocol mappers added to openradius-web client"
    fi
    
    # Assign default client scopes to openradius-web client
    print_info "Assigning default client scopes to openradius-web client..."
    if [ -n "$WEB_CLIENT_ID" ]; then
        for scope in "profile" "email" "roles" "web-origins" "acr"; do
            SCOPE_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get client-scopes \
                -r openradius --fields id,name 2>/dev/null | grep -B1 "\"name\" : \"$scope\"" | grep '"id"' | cut -d'"' -f4)
            if [ -n "$SCOPE_ID" ]; then
                docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh update \
                    clients/$WEB_CLIENT_ID/default-client-scopes/$SCOPE_ID \
                    -r openradius 2>/dev/null || true
            fi
        done
        print_success "Default client scopes assigned"
    fi
    
    # Create openradius-admin client (confidential/service account)
    print_info "Creating openradius-admin client..."
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create clients \
        -r openradius \
        -s clientId=openradius-admin \
        -s name="OpenRadius Admin Client" \
        -s description="Service account for backend admin operations" \
        -s enabled=true \
        -s publicClient=false \
        -s standardFlowEnabled=false \
        -s implicitFlowEnabled=false \
        -s directAccessGrantsEnabled=false \
        -s serviceAccountsEnabled=true \
        -s secret=openradius-admin-secret-2026 \
        -s 'attributes.access.token.lifespan=3600' 2>/dev/null || print_warning "Client may already exist"
    
    # Create openradius-api client (bearer only)
    print_info "Creating openradius-api client..."
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create clients \
        -r openradius \
        -s clientId=openradius-api \
        -s name="OpenRadius API" \
        -s description="Backend API for token validation" \
        -s enabled=true \
        -s publicClient=false \
        -s bearerOnly=true \
        -s standardFlowEnabled=false \
        -s implicitFlowEnabled=false \
        -s directAccessGrantsEnabled=false \
        -s 'attributes.access.token.lifespan=3600' 2>/dev/null || print_warning "Client may already exist"
    
    # Create groups
    print_info "Creating user groups..."
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create groups \
        -r openradius \
        -s name=Administrators \
        -s 'attributes.description=["Full system administrators with all permissions"]' 2>/dev/null || print_warning "Group may already exist"
    
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create groups \
        -r openradius \
        -s name=Users \
        -s 'attributes.description=["Standard users with limited permissions"]' 2>/dev/null || print_warning "Group may already exist"
    
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create groups \
        -r openradius \
        -s name=Managers \
        -s 'attributes.description=["Managers with elevated permissions"]' 2>/dev/null || print_warning "Group may already exist"
    
    # Create roles
    print_info "Creating realm roles..."
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create roles \
        -r openradius \
        -s name=admin \
        -s description="Administrator role with full access" 2>/dev/null || print_warning "Role may already exist"
    
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create roles \
        -r openradius \
        -s name=user \
        -s description="Standard user role" 2>/dev/null || print_warning "Role may already exist"
    
    docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh create roles \
        -r openradius \
        -s name=manager \
        -s description="Manager role with elevated permissions" 2>/dev/null || print_warning "Role may already exist"
    
    # Add 'sub' claim mapper to openid client scope (CRITICAL for backend auth)
    print_info "Adding 'sub' claim mapper to openid scope..."
    OPENID_SCOPE_ID=$(docker exec openradius-keycloak /opt/keycloak/bin/kcadm.sh get client-scopes \
        -r openradius --fields id,name 2>/dev/null | grep -B1 '"name" : "openid"' | grep '"id"' | cut -d'"' -f4)
    
    if [ -n "$OPENID_SCOPE_ID" ]; then
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
        print_success "'sub' claim mapper added successfully"
    else
        print_warning "Could not find openid client scope"
    fi
    fi  # End of else block for manual configuration
    
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
    
    echo -e "${GREEN}OpenRadius has been successfully installed!${NC}\n"
    
    echo -e "${CYAN}Service URLs:${NC}"
    echo -e "  Main App:        ${GREEN}https://$DOMAIN${NC}"
    echo -e "  API:             ${GREEN}https://api.$DOMAIN${NC}"
    echo -e "  Keycloak:        ${GREEN}https://auth.$DOMAIN${NC}"
    echo -e "  Seq Logs:        ${GREEN}https://logs.$DOMAIN${NC}"
    echo -e "  Kafka Console:   ${GREEN}https://kafka.$DOMAIN${NC}"
    echo -e "  Debezium:        ${GREEN}https://cdc.$DOMAIN${NC}"
    echo ""
    
    echo -e "${CYAN}Keycloak Admin:${NC}"
    echo -e "  URL:      ${GREEN}https://auth.$DOMAIN/admin${NC}"
    echo -e "  Username: ${GREEN}admin${NC}"
    echo -e "  Password: ${YELLOW}[See credentials file]${NC}"
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
    
    print_warning "IMPORTANT: Securely store the credentials file and delete it from the server!"
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
        echo -e "${YELLOW}Do you want to remove the existing installation and start fresh? [y/N]: ${NC}"
        read -p "> " remove_confirm
        remove_confirm=${remove_confirm,,}  # Convert to lowercase
        
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
    
    print_header "OpenRadius Enterprise Installation"
    
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
