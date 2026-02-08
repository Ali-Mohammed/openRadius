# =============================================================================
# OpenRadius Backend - Production Docker Image
# =============================================================================
# Enterprise-grade multi-stage build for ASP.NET Core 10.0 application
# Optimized for security, performance, and minimal image size
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file and restore dependencies (cached layer)
COPY ["Backend.csproj", "./"]
RUN dotnet restore "Backend.csproj"

# Copy source code and build
COPY . .
RUN dotnet build "Backend.csproj" -c Release -o /app/build

# -----------------------------------------------------------------------------
# Stage 2: Publish Stage
# -----------------------------------------------------------------------------
FROM build AS publish
RUN dotnet publish "Backend.csproj" -c Release -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# -----------------------------------------------------------------------------
# Stage 3: Runtime Stage
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# Install required runtime dependencies + Docker CLI for system update feature
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
# Add to docker group (created by docker-ce-cli package) for Docker socket access
RUN groupadd -r openradius && useradd -r -g openradius -G docker openradius

# Set working directory
WORKDIR /app

# Copy published application from publish stage
COPY --from=publish /app/publish .

# Create logs directory and set permissions
RUN mkdir -p /app/Logs && \
    chown -R openradius:openradius /app

# Switch to non-root user
USER openradius

# Expose ports
# 5000: HTTP
# 5001: HTTPS (if configured)
EXPOSE 5000
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Entry point
ENTRYPOINT ["dotnet", "Backend.dll"]
