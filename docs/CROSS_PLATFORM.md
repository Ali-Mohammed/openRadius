# Cross-Platform Compatibility Guide

## Supported Platforms

✅ **Windows 10/11** (PowerShell 5.1+, PowerShell Core 7+)  
✅ **macOS** (Monterey 12+)  
✅ **Ubuntu** (20.04+)  
✅ **Other Linux** (Debian, Fedora, Arch, etc.)  
✅ **WSL2** (Windows Subsystem for Linux)

## Platform-Specific Requirements

### Windows
- **Docker Desktop for Windows**
- **PowerShell** (built-in) or **PowerShell Core**
- **.NET 10 SDK**
- **Node.js 18+**
- **pnpm**: `npm install -g pnpm`

### macOS
- **Docker Desktop for Mac**
- **Homebrew** (recommended): `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- **.NET 10 SDK**: `brew install dotnet`
- **Node.js**: `brew install node`
- **pnpm**: `npm install -g pnpm`

### Ubuntu/Debian
```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# .NET 10
wget https://dot.net/v1/dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 10.0

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18

# pnpm
npm install -g pnpm
```

### Fedora/RHEL
```bash
# Docker
sudo dnf install docker docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER

# .NET 10
sudo dnf install dotnet-sdk-10.0

# Node.js
sudo dnf install nodejs

# pnpm
npm install -g pnpm
```

## Running the Application

### Windows

```powershell
# Option 1: Automated (Recommended)
.\start.ps1

# Option 2: Manual
docker-compose up -d
cd Backend
dotnet run  # In one terminal
cd Frontend
pnpm dev    # In another terminal
```

### Linux/macOS/WSL

```bash
# Option 1: Automated (Recommended)
chmod +x start.sh
./start.sh

# Option 2: Manual
docker-compose up -d
cd Backend && dotnet run &  # Background
cd Frontend && pnpm dev &   # Background
```

## Docker Compose Compatibility

The `docker-compose.yml` works with:
- **Docker Compose V1**: `docker-compose up -d`
- **Docker Compose V2**: `docker compose up -d`

The scripts auto-detect and use the correct command.

## Port Configuration

All platforms use the same ports:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5000
- **Keycloak**: http://localhost:8080
- **PostgreSQL**: localhost:5432

## Troubleshooting

### Windows

**Docker not found:**
```powershell
# Ensure Docker Desktop is running
Get-Service | Where-Object {$_.Name -like "*docker*"}
```

**PowerShell execution policy:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Port already in use:**
```powershell
netstat -ano | findstr :5173
# Kill process by PID
taskkill /PID <PID> /F
```

### macOS

**Docker not found:**
```bash
# Ensure Docker Desktop is running
docker info
```

**Permission denied:**
```bash
chmod +x start.sh setup-keycloak.sh
```

**Port already in use:**
```bash
lsof -i :5173
# Kill process
kill -9 <PID>
```

### Linux

**Docker permission denied:**
```bash
sudo usermod -aG docker $USER
newgrp docker
# Or use sudo for docker commands
```

**Cannot connect to Docker daemon:**
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

**Port already in use:**
```bash
netstat -tulpn | grep 5173
# Kill process
kill -9 <PID>
```

### WSL2

**Docker Desktop integration:**
- Enable WSL2 integration in Docker Desktop settings
- Ensure your WSL2 distro is selected

**File permissions:**
```bash
# If scripts show ^M errors (Windows line endings)
dos2unix start.sh
# Or use sed
sed -i 's/\r$//' start.sh
```

## Script Compatibility

### start.ps1 (Windows)
- Compatible with PowerShell 5.1+ and PowerShell Core 7+
- Auto-detects Docker Compose version
- Opens terminals automatically

### start.sh (Linux/macOS/WSL)
- Compatible with bash, zsh, sh
- Auto-detects OS (Linux/macOS/WSL)
- Falls back to npm if pnpm not available
- Graceful handling of missing dependencies

## Environment Variables

All platforms use the same `.env` files:

**Backend/.env:**
```bash
# No .env needed - uses appsettings.json
```

**Frontend/.env:**
```bash
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
VITE_API_URL=http://localhost:5000
```

## Database Connection

All platforms connect to PostgreSQL the same way:
```
Host: localhost
Port: 5432
Database: openradius
Username: admin
Password: admin123
```

## IDE Recommendations

### Windows
- **Visual Studio 2022** (Backend)
- **VS Code** (Frontend)
- **Rider** (Full stack)

### macOS
- **VS Code** (Full stack)
- **Rider** (Full stack)
- **Visual Studio for Mac** (Backend)

### Linux
- **VS Code** (Full stack)
- **Rider** (Full stack)

## CI/CD Compatibility

The Docker setup works with:
- **GitHub Actions** (Linux, Windows, macOS runners)
- **GitLab CI** (Docker-in-Docker)
- **Azure DevOps** (All platforms)
- **Jenkins** (All platforms)

Example GitHub Actions workflow works on all platforms:
```yaml
runs-on: ubuntu-latest  # or windows-latest, macos-latest
```

## Known Issues

### Windows
- Line endings: Scripts use LF, ensure git is configured: `git config --global core.autocrlf false`
- Docker Desktop WSL2 backend recommended over Hyper-V

### macOS (Apple Silicon)
- All Docker images support ARM64
- Keycloak runs natively on Apple Silicon

### Linux
- SELinux may block Docker volumes (Fedora/RHEL): Use `sudo setenforce 0` for testing

## Getting Help

Platform-specific issues:
- Windows: Check Docker Desktop logs
- macOS: Check Console.app for Docker logs
- Linux: `journalctl -u docker`
- WSL: Check both Windows Event Viewer and WSL logs

For all platforms:
```bash
docker logs openradius-keycloak
docker logs openradius-postgres
docker logs openradius-keycloak-init
```
