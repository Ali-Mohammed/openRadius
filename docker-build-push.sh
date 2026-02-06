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
    print_header "Building Backend Image"
    print_info "Image: ${BACKEND_IMAGE}:${VERSION}"
    
    if [ "$VERSION" != "latest" ]; then
        docker build \
            -t "${BACKEND_IMAGE}:${VERSION}" \
            -t "${BACKEND_IMAGE}:latest" \
            ./Backend
    else
        docker build \
            -t "${BACKEND_IMAGE}:latest" \
            ./Backend
    fi
    
    print_success "Backend image built successfully"
}

# Build frontend image
build_frontend() {
    print_header "Building Frontend Image"
    print_info "Image: ${FRONTEND_IMAGE}:${VERSION}"
    
    if [ "$VERSION" != "latest" ]; then
        docker build \
            -t "${FRONTEND_IMAGE}:${VERSION}" \
            -t "${FRONTEND_IMAGE}:latest" \
            ./Frontend
    else
        docker build \
            -t "${FRONTEND_IMAGE}:latest" \
            ./Frontend
    fi
    
    print_success "Frontend image built successfully"
}

# Push backend image
push_backend() {
    print_header "Pushing Backend Image to Docker Hub"
    
    if [ "$VERSION" != "latest" ]; then
        print_info "Pushing ${BACKEND_IMAGE}:${VERSION}..."
        docker push "${BACKEND_IMAGE}:${VERSION}"
        print_success "Pushed ${BACKEND_IMAGE}:${VERSION}"
    fi
    
    print_info "Pushing ${BACKEND_IMAGE}:latest..."
    docker push "${BACKEND_IMAGE}:latest"
    print_success "Pushed ${BACKEND_IMAGE}:latest"
}

# Push frontend image
push_frontend() {
    print_header "Pushing Frontend Image to Docker Hub"
    
    if [ "$VERSION" != "latest" ]; then
        print_info "Pushing ${FRONTEND_IMAGE}:${VERSION}..."
        docker push "${FRONTEND_IMAGE}:${VERSION}"
        print_success "Pushed ${FRONTEND_IMAGE}:${VERSION}"
    fi
    
    print_info "Pushing ${FRONTEND_IMAGE}:latest..."
    docker push "${FRONTEND_IMAGE}:latest"
    print_success "Pushed ${FRONTEND_IMAGE}:latest"
}

# Verify images
verify_images() {
    print_header "Verifying Built Images"
    
    echo -e "\n${BLUE}Backend Images:${NC}"
    docker images | grep "${DOCKER_USERNAME}/openradius-backend" || print_warning "No backend images found"
    
    echo -e "\n${BLUE}Frontend Images:${NC}"
    docker images | grep "${DOCKER_USERNAME}/openradius-frontend" || print_warning "No frontend images found"
}

# Summary
print_summary() {
    print_header "Build & Push Summary"
    
    echo -e "${GREEN}✓ Backend:  ${BACKEND_IMAGE}:${VERSION}${NC}"
    echo -e "${GREEN}✓ Frontend: ${FRONTEND_IMAGE}:${VERSION}${NC}"
    
    if [ "$VERSION" != "latest" ]; then
        echo -e "${GREEN}✓ Both also tagged as :latest${NC}"
    fi
    
    echo -e "\n${BLUE}Docker Hub URLs:${NC}"
    echo -e "  Backend:  https://hub.docker.com/r/${DOCKER_USERNAME}/openradius-backend"
    echo -e "  Frontend: https://hub.docker.com/r/${DOCKER_USERNAME}/openradius-frontend"
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
    check_docker_login
    
    # Build images
    echo ""
    build_backend
    echo ""
    build_frontend
    
    # Push images
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
}

# Run main function
main "$@"
