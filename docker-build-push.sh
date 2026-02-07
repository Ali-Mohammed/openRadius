#!/bin/bash

# =============================================================================
# OpenRadius - Docker Build & Push Script
# =============================================================================
# Automates building and pushing backend and frontend Docker images
# Usage: ./docker-build-push.sh [version]
# Example: ./docker-build-push.sh v1.0.0
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="alimohammed"
BACKEND_IMAGE="${DOCKER_USERNAME}/openradius-backend"
FRONTEND_IMAGE="${DOCKER_USERNAME}/openradius-frontend"
VERSION="${1:-latest}"
PLATFORMS="linux/amd64,linux/arm64"  # Support both Intel/AMD and ARM architectures

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
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
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if Docker is running
check_docker() {
    print_info "Checking Docker status..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Setup Docker buildx for multi-platform builds
setup_buildx() {
    print_info "Setting up Docker buildx for multi-platform builds..."
    
    # Create builder if it doesn't exist
    if ! docker buildx ls | grep -q "openradius-builder"; then
        print_info "Creating new buildx builder..."
        docker buildx create --name openradius-builder --use --bootstrap
    else
        print_info "Using existing buildx builder..."
        docker buildx use openradius-builder
    fi
    
    print_success "Buildx configured for platforms: ${PLATFORMS}"
}

# Check if logged in to Docker Hub
check_docker_login() {
    print_info "Checking Docker Hub authentication..."
    if ! docker info 2>&1 | grep -q "Username: ${DOCKER_USERNAME}"; then
        print_warning "Not logged in to Docker Hub"
        print_info "Please login to Docker Hub..."
        docker login
    fi
    print_success "Authenticated to Docker Hub"
}

# Build backend image
build_backend() {
    print_header "Building Backend Image (Multi-Platform)"
    print_info "Image: ${BACKEND_IMAGE}:${VERSION}"
    print_info "Platforms: ${PLATFORMS}"
    
    if [ "$VERSION" != "latest" ]; then
        docker buildx build \
            --platform "${PLATFORMS}" \
            -t "${BACKEND_IMAGE}:${VERSION}" \
            -t "${BACKEND_IMAGE}:latest" \
            --push \
            ./Backend
    else
        docker buildx build \
            --platform "${PLATFORMS}" \
            -t "${BACKEND_IMAGE}:latest" \
            --push \
            ./Backend
    fi
    
    print_success "Backend image built and pushed for ${PLATFORMS}"
}

# Build frontend image
build_frontend() {
    print_header "Building Frontend Image (Multi-Platform)"
    print_info "Image: ${FRONTEND_IMAGE}:${VERSION}"
    print_info "Platforms: ${PLATFORMS}"
    
    if [ "$VERSION" != "latest" ]; then
        docker buildx build \
            --platform "${PLATFORMS}" \
            -t "${FRONTEND_IMAGE}:${VERSION}" \
            -t "${FRONTEND_IMAGE}:latest" \
            --push \
            ./Frontend
    else
        docker buildx build \
            --platform "${PLATFORMS}" \
            -t "${FRONTEND_IMAGE}:latest" \
            --push \
            ./Frontend
    fi
    
    print_success "Frontend image built and pushed for ${PLATFORMS}"
}

# Push backend image
push_backend() {
    print_info "Backend images already pushed during build (buildx --push)"
    print_success "Backend available on Docker Hub for ${PLATFORMS}"
}

# Push frontend image
push_frontend() {
    print_info "Frontend images already pushed during build (buildx --push)"
    print_success "Frontend available on Docker Hub for ${PLATFORMS}"
}

# Verify images
verify_images() {
    print_header "Verifying Multi-Platform Images"
    
    echo -e "\n${BLUE}Backend Manifest:${NC}"
    docker buildx imagetools inspect "${BACKEND_IMAGE}:${VERSION}" | grep -E "Name:|Platform:" || print_warning "Could not inspect backend image"
    
    echo -e "\n${BLUE}Frontend Manifest:${NC}"
    docker buildx imagetools inspect "${FRONTEND_IMAGE}:${VERSION}" | grep -E "Name:|Platform:" || print_warning "Could not inspect frontend image"
}

# Summary
print_summary() {
    print_header "Build & Push Summary"
    
    echo -e "${GREEN}✓ Backend:  ${BACKEND_IMAGE}:${VERSION}${NC}"
    echo -e "${GREEN}✓ Frontend: ${FRONTEND_IMAGE}:${VERSION}${NC}"
    echo -e "${GREEN}✓ Platforms: ${PLATFORMS}${NC}"
    
    if [ "$VERSION" != "latest" ]; then
        echo -e "${GREEN}✓ Both also tagged as :latest${NC}"
    fi
    
    echo -e "\n${BLUE}Docker Hub URLs:${NC}"
    echo -e "  Backend:  https://hub.docker.com/r/${DOCKER_USERNAME}/openradius-backend"
    echo -e "  Frontend: https://hub.docker.com/r/${DOCKER_USERNAME}/openradius-frontend"
    
    echo -e "\n${BLUE}Supported Platforms:${NC}"
    echo -e "  ✓ linux/amd64 (Intel/AMD servers, Ubuntu, Debian, etc.)"
    echo -e "  ✓ linux/arm64 (Apple Silicon, ARM servers, Raspberry Pi, etc.)"
}

# Cleanup on error
cleanup_on_error() {
    print_error "Build/Push failed. Check the error messages above."
    exit 1
}

trap cleanup_on_error ERR

# Main execution
main() {
    clear
    print_header "OpenRadius - Docker Build & Push"
    
    echo -e "${BLUE}Version: ${VERSION}${NC}"
    echo -e "${BLUE}Username: ${DOCKER_USERNAME}${NC}\n"
    
    # Confirmation prompt
    if [ "$VERSION" != "latest" ]; then
        read -p "Build and push version ${VERSION} (and latest)? (y/N): " -n 1 -r
    else
        read -p "Build and push latest version? (y/N): " -n 1 -r
    fi
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Build cancelled by user"
        exit 0
    fi
    
    # Pre-flight checks
    check_docker
    setup_buildx
    check_docker_login
    
    # Build images (buildx automatically pushes with --push flag)
    echo ""
    build_backend
    echo ""
    build_frontend
    
    # Verify images (push already done during build)
    echo ""
    push_backend
    echo ""
    push_frontend
    
    # Verify and summarize
    echo ""
    verify_images
    echo ""
    print_summary
    
    print_success "\nAll done! Images are available on Docker Hub."
    
    # Credits
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}Powered by Ali Al-Estarbadee${NC}"
    echo -e "${BLUE}Email: ali87mohammed@hotmail.com${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Run main function
main "$@"
