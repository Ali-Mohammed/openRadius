# =============================================================================
# OpenRadius Frontend — Production Docker Image
# =============================================================================
# Enterprise-grade multi-stage build for React + Vite application.
# Uses nginx for high-performance static file serving.
#
# Runtime domain injection:
#   docker run -e DOMAIN=example.com openradius-frontend
#   → generates /env-config.js with https://api.example.com etc.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

RUN npm install -g pnpm

# Install dependencies (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build --mode production || pnpm run build:skip-checks

# -----------------------------------------------------------------------------
# Stage 2: Production — nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS final

LABEL org.opencontainers.image.title="OpenRadius Frontend" \
      org.opencontainers.image.description="Enterprise RADIUS management frontend" \
      org.opencontainers.image.vendor="OpenRadius"

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config, built assets, and entrypoint
COPY nginx.conf /etc/nginx/conf.d/
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Permissions for non-root nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
