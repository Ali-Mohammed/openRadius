<div align="center">

# 🌐 OpenRadius

### Enterprise RADIUS Management System

*A modern, full-stack RADIUS management platform with multi-tenancy, OIDC authentication, and comprehensive workspace management*

[![ASP.NET Core](https://img.shields.io/badge/ASP.NET%20Core-10.0-512BD4?style=for-the-badge&logo=dotnet)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Keycloak](https://img.shields.io/badge/Keycloak-26.4-008aaa?style=for-the-badge&logo=keycloak&logoColor=white)](https://www.keycloak.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

[Features](#-features) • [Installation](#-installation) • [Documentation](#-documentation) • [Architecture](#-architecture) • [API](#-api-reference)

</div>

---

## 📋 Table of Contents

- [Installation](#-installation)
  - [Production Install (Interactive)](#quick-install-interactive)
  - [Unattended Install](#unattended-install)
  - [Resume Failed Install](#resume-a-failed-installation)
  - [CLI Reference](#cli-reference)
  - [What Gets Deployed](#what-the-installer-deploys)
  - [Local Testing](#local-testing)
  - [Docker Images](#docker-images)
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Quick Start (Development)](#-quick-start-development)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Installation

### Production Installation (Ubuntu)

> **System Requirements:**
> - **Operating System:** Ubuntu 24.04 LTS (tested and recommended)
> - **Platform:** Linux required
> - **Architecture:** x86_64 / amd64
> - **CPU:** 2 cores minimum (4+ recommended)
> - **Memory:** 4GB RAM minimum (8GB recommended)
> - **Storage:** 20GB available space
> - **Ports:** 80, 443, 9094 must be available
> - **Network:** Internet connectivity required

#### Quick Install (Interactive)

```bash
# Download and run installation script
curl -fsSL https://raw.githubusercontent.com/Ali-Mohammed/openRadius/main/install-openradius.sh -o install-openradius.sh
chmod +x install-openradius.sh
sudo ./install-openradius.sh
```

Or clone the repo first:

```bash
git clone https://github.com/Ali-Mohammed/openRadius.git
cd openRadius
chmod +x install-openradius.sh
sudo ./install-openradius.sh
```

The interactive installer will prompt you for:
1. **Domain name** — e.g. `example.com`
2. **SSL email** — for Let's Encrypt certificate generation
3. **Password mode** — auto-generate (recommended) or enter custom passwords
4. **Sample data** — optionally install sample RADIUS data
5. **Keycloak auto-config** — auto-create realm, clients, and scopes
6. **Automated backups** — enable daily backups at 2:00 AM

#### Unattended Install

Create a config file (`install-config.env`):

```env
DOMAIN=example.com
SSL_EMAIL=admin@example.com
PASSWORD_MODE=auto            # auto | custom
INSTALL_SAMPLE=n
CONFIGURE_KEYCLOAK=y
ENABLE_BACKUP=y
SKIP_SSL=false                # true to skip Let's Encrypt

# Only required if PASSWORD_MODE=custom (min 16 characters each):
# POSTGRES_PASSWORD=...
# KEYCLOAK_ADMIN_PASSWORD=...
# REDIS_PASSWORD=...
```

Run:

```bash
sudo ./install-openradius.sh --unattended --config ./install-config.env
```

#### Resume a Failed Installation

The installer saves checkpoints automatically. If it fails mid-way:

```bash
# Resume from where it left off
sudo ./install-openradius.sh --resume

# Resume from a specific step
sudo ./install-openradius.sh --resume --from pull_docker_images
```

<details>
<summary><b>Available Installation Steps (for <code>--from</code>)</b></summary>

| Step | Description |
|------|-------------|
| `preflight_checks` | Disk, RAM, CPU, DNS, ports validation |
| `install_docker` | Install Docker Engine |
| `install_docker_compose` | Install Docker Compose |
| `install_prerequisites` | Install required system packages |
| `configure_firewall` | Configure UFW firewall rules |
| `collect_configuration` | Prompt for domain, passwords, options |
| `generate_env_file` | Generate `.env` file from configuration |
| `save_credentials` | Save credentials to secure file |
| `show_dns_instructions` | Display DNS A record setup guide |
| `generate_ssl_certificates` | Obtain Let's Encrypt SSL certificates |
| `clone_repository` | Clone OpenRadius from GitHub |
| `configure_nginx` | Set up nginx reverse proxy |
| `generate_htpasswd_files` | Generate htpasswd for admin consoles |
| `generate_edge_env` | Generate EdgeRuntime `.env` template |
| `prepare_keycloak_import` | Prepare Keycloak realm import JSON |
| `pull_docker_images` | Pull all Docker images |
| `start_services` | Start all Docker Compose services |
| `wait_for_services` | Health check all services |
| `configure_keycloak` | Auto-configure Keycloak realm/clients |
| `setup_backup` | Enable automated daily backups |

</details>

#### CLI Reference

```
Usage: sudo ./install-openradius.sh [OPTIONS]

Options:
  --unattended, -u        Non-interactive mode (requires --config)
  --config, -c FILE       Path to config file for unattended install
  --resume, -r            Resume a previously failed installation
  --from STEP             Resume from a specific step (use with --resume)
  --log FILE              Custom log file path (default: /opt/openradius/install.log)
  --version, -v           Show version and exit
  --help, -h              Show this help message
```

#### What the Installer Deploys

The script installs and configures the full OpenRadius stack:

| Service | Description | URL |
|---------|-------------|-----|
| **Frontend** | React 19 SPA | `https://<domain>` |
| **Backend API** | ASP.NET Core 10 | `https://api.<domain>` |
| **Keycloak** | Identity & Access Management | `https://auth.<domain>` |
| **PostgreSQL** | Primary database | Internal |
| **Redis** | Caching & sessions | Internal |
| **Redpanda** | Kafka-compatible event streaming | `kafka.<domain>:9094` |
| **Redpanda Console** | Kafka UI (Basic Auth) | `https://kafka.<domain>` |
| **Debezium** | Change Data Capture | `https://cdc.<domain>` |
| **Seq** | Structured logging & search | `https://logs.<domain>` |
| **nginx** | Reverse proxy + SSL termination | Ports 80/443 |

After installation, credentials are saved to:
- **Credentials file:** `/opt/openradius/credentials.txt` (chmod 600)
- **Install log:** `/opt/openradius/install.log`

#### Post-Install Commands

```bash
# View all service logs
docker compose -f docker-compose.prod.yml logs -f

# Check service status
docker compose -f docker-compose.prod.yml ps

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Stop all services
docker compose -f docker-compose.prod.yml down

# Update to latest images
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```

**📚 Complete Guide**: [INSTALLATION_GUIDE.md](docs/INSTALLATION_GUIDE.md)

### Local Testing

Test the full stack locally without domain/SSL:

```bash
# Start local stack
docker compose -f docker-compose.local.yml up -d

# Access services
# Frontend:  http://localhost
# API:       http://localhost:5000
# Keycloak:  http://localhost:8080
# Seq Logs:  http://localhost:5341
```

**📚 Testing Guide**: [LOCAL_TESTING_GUIDE.md](docs/LOCAL_TESTING_GUIDE.md)

### Docker Images

Pre-built images available on Docker Hub:
- **Backend**: `alimohammed/openradius-backend:latest`
- **Frontend**: `alimohammed/openradius-frontend:latest`

**📚 Docker Guide**: [DOCKER_DEPLOYMENT_GUIDE.md](docs/DOCKER_DEPLOYMENT_GUIDE.md)

---

## 🌟 Overview

**OpenRadius** is an enterprise-grade RADIUS management system built with modern technologies. It provides a complete solution for managing RADIUS users, profiles, NAS devices, IP pools, and integrations across multiple workspaces with robust authentication and authorization.

### Why OpenRadius?

- 🏢 **Multi-Tenant Architecture** - Isolated workspaces for different organizations
- 🔐 **Enterprise Authentication** - OIDC/OAuth2 with Keycloak integration
- 🎯 **Comprehensive RADIUS Management** - Users, profiles, NAS, tags, groups
- 🗑️ **Soft Delete & Trash** - Never lose data, restore anytime
- 🌍 **Internationalization** - Built-in i18n support
- 🎨 **Modern UI/UX** - React 19 with Tailwind CSS and shadcn/ui
- 🚀 **Production Ready** - Docker, PostgreSQL, automated deployment

---

## ✨ Key Features

### 🔒 Authentication & Authorization
- **OpenID Connect (OIDC)** authentication with Keycloak
- **Multiple OIDC Providers** configurable from admin panel
- **Role-Based Access Control (RBAC)** with 9 predefined roles
- **Permission-Based System** with 58 granular permissions
- **User Groups** for team-based access management
- **JWT Token Management** with automatic refresh

### 🏢 Multi-Tenancy & Workspaces
- **Workspace Isolation** - Complete data separation
- **Tenant-Based Database Context** - Automatic tenant resolution
- **Default & Current Workspace** - Per-user workspace preferences
- **Workspace Switching** - Seamless context switching
- **Workspace Settings** - Customizable per workspace

### 📊 RADIUS Management
- **RADIUS Users** - Complete user lifecycle management
- **RADIUS Profiles** - Reusable configuration profiles
- **RADIUS NAS** - Network Access Server management
- **IP Pool Management** - Dynamic IP allocation
- **Tag System** - Flexible categorization
- **Group Management** - Organize users efficiently
- **SAS Integration** - External system synchronization

### 🗑️ Data Management
- **Soft Delete** - All entities support soft delete
- **Trash & Restore** - One-click restore functionality
- **Audit Trail** - Track all changes and deletions
- **Bulk Operations** - Mass updates and deletions
- **Export/Import** - Data portability

### 🎨 User Experience
- **Modern Dashboard** - Real-time statistics and insights
- **Responsive Design** - Mobile, tablet, and desktop support
- **Dark/Light Theme** - User preference support
- **Internationalization** - Multi-language support (i18n)
- **Real-time Updates** - SignalR for live data sync
- **Advanced Filtering** - Powerful search and filter options

### 🔌 Microservices & Integration
- **Microservice Management** - Connected services monitoring dashboard
- **Approval Workflow** - Machine-based authentication and authorization
- **Auto-Reconnection** - Automatic reconnection on approval
- **Health Monitoring** - Real-time heartbeat and activity tracking
- **Service Metrics** - CPU, RAM, and performance monitoring
- **Approval System** - Pending/Approved tabs with revoke and delete
- **Machine Identity** - Hardware-based unique identification
- **Token Security** - HMACSHA256-based approval tokens

---

## 🛠️ Tech Stack

<div align="center">

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| ASP.NET Core | 10.0 | Web API Framework |
| Entity Framework Core | 10.0 | ORM |
| PostgreSQL | 16 | Database |
| Keycloak | 26.4 | Identity Provider |
| Finbuckle MultiTenant | - | Multi-tenancy |
| SignalR | - | Real-time Communication |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI Library |
| TypeScript | 5.7 | Type Safety |
| Vite | 7.3 | Build Tool |
| Tailwind CSS | 4.1 | Styling |
| shadcn/ui | - | Component Library |
| React Router | 7.11 | Routing |
| TanStack Query | 5 | Data Fetching |
| Keycloak JS | 26.2 | OIDC Client |

### DevOps

| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Service Orchestration |
| GitHub Actions | CI/CD (future) |

</div>

---

## 🏃 Quick Start (Development)

### Prerequisites

Before you begin, ensure you have the following installed:

- **[.NET 10 SDK](https://dotnet.microsoft.com/download)** - Backend runtime
- **[Node.js 18+](https://nodejs.org/)** - Frontend runtime
- **[pnpm](https://pnpm.io/)** - Package manager (`npm install -g pnpm`)
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** - For PostgreSQL & Keycloak

### Optional
- **[Git](https://git-scm.com/)** - Version control
- **[VS Code](https://code.visualstudio.com/)** - Recommended IDE

---

### Development Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Ali-Mohammed/openRadius.git
cd openRadius
```

### 2️⃣ Start Docker Services

Start PostgreSQL and Keycloak:

```bash
docker compose up -d
```

Wait for services to be healthy (~60 seconds):

```bash
docker compose ps
```

### 3️⃣ Configure Environment

The application is pre-configured with default settings. Keycloak realm is automatically imported.

**Default Credentials:**
- Keycloak Admin: `admin` / `admin`
- Test User: Create via Keycloak Admin Console

### 4️⃣ Setup Backend

```bash
cd Backend

# Apply database migrations
dotnet ef database update --context MasterDbContext
dotnet ef database update --context ApplicationDbContext

# Run backend
dotnet run
```

Backend runs on: **http://localhost:5000**
Swagger UI: **http://localhost:5000/swagger**

### 5️⃣ Setup Frontend

```bash
cd Frontend

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Frontend runs on: **http://localhost:5173**

### 6️⃣ Access the Application

1. Open **http://localhost:5173**
2. Click **Login**
3. Sign in with your Keycloak credentials
4. Explore the Dashboard!

---

## 📁 Project Structure

```
OpenRadius/
├── 📂 Backend/                          # ASP.NET Core Web API
│   ├── 📂 Controllers/                  # API Controllers
│   │   ├── OidcSettingsController.cs   # OIDC provider management
│   │   ├── RadiusUserController.cs     # RADIUS user CRUD
│   │   ├── RadiusProfileController.cs  # Profile management
│   │   ├── RadiusNasController.cs      # NAS management
│   │   ├── WorkspaceController.cs      # Workspace operations
│   │   ├── TenantController.cs         # Tenant switching
│   │   └── UserManagementController.cs # User administration
│   ├── 📂 Data/                         # Database contexts
│   │   ├── MasterDbContext.cs          # Master database (users, workspaces)
│   │   └── ApplicationDbContext.cs     # Tenant database (RADIUS data)
│   ├── 📂 Models/                       # Domain models
│   │   ├── RadiusUser.cs
│   │   ├── RadiusProfile.cs
│   │   ├── RadiusNas.cs
│   │   ├── RadiusIpPool.cs
│   │   ├── OidcSettings.cs
│   │   └── Workspace.cs
│   ├── 📂 Services/                     # Business logic
│   │   └── UserWorkspaceTenantResolver.cs
│   ├── 📂 Migrations/                   # EF Core migrations
│   │   ├── MasterDb/
│   │   └── WorkspaceDb/
│   ├── 📂 Hubs/                         # SignalR hubs
│   │   └── SasSyncHub.cs
│   ├── appsettings.json                # Configuration
│   └── Program.cs                      # Application entry point
│
├── 📂 Frontend/                         # React Application
│   ├── 📂 src/
│   │   ├── 📂 components/              # Reusable components
│   │   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── layout/                # Layout components
│   │   │   └── forms/                 # Form components
│   │   ├── 📂 pages/                   # Page components
│   │   │   ├── LoginPage.tsx          # OIDC login
│   │   │   ├── Dashboard.tsx          # Main dashboard
│   │   │   ├── RadiusUsers.tsx        # User management
│   │   │   ├── OidcSettings.tsx       # OIDC configuration
│   │   │   └── WorkspaceSettings.tsx  # Workspace config
│   │   ├── 📂 contexts/                # React contexts
│   │   │   └── KeycloakContext.tsx    # Auth context
│   │   ├── 📂 lib/                     # Utilities
│   │   │   ├── api.ts                 # API client
│   │   │   └── utils.ts               # Helpers
│   │   ├── App.tsx                    # Root component
│   │   └── main.tsx                   # Entry point
│   ├── .env                           # Environment variables
│   ├── package.json
│   └── vite.config.ts
│
├── 📂 keycloak/                         # Keycloak configuration
│   ├── keycloak-config.json           # Realm import
│   └── themes/                        # Custom themes
│
├── 📂 docs/                             # Documentation
│   ├── OIDC_AUTHENTICATION.md
│   ├── KEYCLOAK_SETUP.md
│   ├── SOFT_DELETE_IMPLEMENTATION.md
│   ├── MULTI_TENANT_IMPLEMENTATION.md
│   └── API_DOCUMENTATION.md
│
├── docker-compose.yml                  # Docker orchestration
├── init-db.sh                         # Database initialization
└── README.md                          # This file
```

---

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

| Document | Description |
|----------|-------------|
| [OIDC Authentication](docs/OIDC_AUTHENTICATION.md) | Complete guide to OIDC implementation |
| [Keycloak Setup](docs/KEYCLOAK_SETUP.md) | Step-by-step Keycloak configuration |
| [Soft Delete Implementation](docs/SOFT_DELETE_IMPLEMENTATION.md) | Trash management system |
| [Multi-Tenant Architecture](docs/MULTI_TENANT_IMPLEMENTATION.md) | Workspace isolation design |
| [Quick Start Guide](docs/QUICKSTART.md) | Fast setup instructions |
| [Backend README](docs/Backend-README.md) | Backend development guide |
| [Frontend README](docs/Frontend-README.md) | Frontend development guide |
| [Documentation Index](docs/DOCUMENTATION_INDEX.md) | Complete docs index |

---

## 🔌 API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All endpoints require JWT Bearer token from OIDC:

```bash
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

<details>
<summary><b>🔐 OIDC Settings</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/OidcSettings/providers` | Get all active OIDC providers |
| GET | `/OidcSettings/{id}` | Get specific OIDC provider |
| POST | `/OidcSettings` | Create new OIDC provider |
| PUT | `/OidcSettings/{id}` | Update OIDC provider |
| DELETE | `/OidcSettings/{id}` | Soft delete provider |
| POST | `/OidcSettings/{id}/restore` | Restore deleted provider |
| PUT | `/OidcSettings/{id}/toggle-active` | Activate/deactivate provider |
| POST | `/OidcSettings/test` | Test provider connectivity |

</details>

<details>
<summary><b>👤 User Management</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Users/me` | Get current user info |
| GET | `/Users` | Get all users |
| GET | `/Users/{id}` | Get user by ID |
| POST | `/Users` | Create new user |
| PUT | `/Users/{id}` | Update user |
| DELETE | `/Users/{id}` | Soft delete user |
| POST | `/Users/{id}/restore` | Restore deleted user |
| GET | `/Users/trash` | Get deleted users |

</details>

<details>
<summary><b>📡 RADIUS Users</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/RadiusUser` | Get all RADIUS users |
| GET | `/RadiusUser/{id}` | Get user by ID |
| POST | `/RadiusUser` | Create RADIUS user |
| PUT | `/RadiusUser/{id}` | Update RADIUS user |
| DELETE | `/RadiusUser/{id}` | Soft delete user |
| POST | `/RadiusUser/{id}/restore` | Restore user |
| GET | `/RadiusUser/trash` | Get deleted users |

</details>

<details>
<summary><b>⚙️ RADIUS Profiles</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/RadiusProfile` | Get all profiles |
| GET | `/RadiusProfile/{id}` | Get profile by ID |
| POST | `/RadiusProfile` | Create profile |
| PUT | `/RadiusProfile/{id}` | Update profile |
| DELETE | `/RadiusProfile/{id}` | Soft delete profile |
| POST | `/RadiusProfile/{id}/restore` | Restore profile |
| GET | `/RadiusProfile/trash` | Get deleted profiles |

</details>

<details>
<summary><b>🖥️ RADIUS NAS</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/RadiusNas` | Get all NAS devices |
| GET | `/RadiusNas/{id}` | Get NAS by ID |
| POST | `/RadiusNas` | Create NAS device |
| PUT | `/RadiusNas/{id}` | Update NAS device |
| DELETE | `/RadiusNas/{id}` | Soft delete NAS |
| POST | `/RadiusNas/{id}/restore` | Restore NAS |
| GET | `/RadiusNas/trash` | Get deleted NAS |

</details>

<details>
<summary><b>🏢 Workspace Management</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Workspace` | Get all workspaces |
| GET | `/Workspace/{id}` | Get workspace by ID |
| POST | `/Workspace` | Create workspace |
| PUT | `/Workspace/{id}` | Update workspace |
| DELETE | `/Workspace/{id}` | Soft delete workspace |
| POST | `/Workspace/{id}/restore` | Restore workspace |
| GET | `/Workspace/deleted` | Get deleted workspaces |

</details>

<details>
<summary><b>🔄 Tenant Operations</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Tenant/current` | Get current tenant info |
| GET | `/Tenant/available` | Get available tenants |
| POST | `/Tenant/switch` | Switch to different tenant |
| POST | `/Tenant/set-default` | Set default workspace |

</details>

📖 **Full API Documentation**: [Swagger UI](http://localhost:5000/swagger)

---

## ⚙️ Configuration

### Backend Configuration

**appsettings.json:**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=openradius;Username=admin;Password=admin123"
  },
  "Authentication": {
    "Schemes": {
      "Bearer": {
        "ValidAudiences": ["openradius-web"],
        "ValidIssuer": "http://localhost:8080/realms/openradius"
      }
    }
  },
  "Finbuckle": {
    "MultiTenant": {
      "Strategy": "UserWorkspaceTenant"
    }
  }
}
```

### Frontend Configuration

**.env:**
```env
# API Configuration
VITE_API_URL=http://localhost:5000

# OIDC/Keycloak Configuration
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
```

### Docker Configuration

**docker-compose.yml:**
- PostgreSQL 16 on port 5432
- Keycloak 26.4 on port 8080
- Automatic realm import
- Persistent volumes

---

## 💻 Development

### Backend Development

```bash
cd Backend

# Watch mode
dotnet watch run

# Run tests
dotnet test

# Create migration
dotnet ef migrations add <MigrationName> --context MasterDbContext

# Apply migrations
dotnet ef database update --context MasterDbContext
```

### Frontend Development

```bash
cd Frontend

# Development server
pnpm dev

# Type checking
pnpm tsc

# Linting
pnpm lint

# Build for production
pnpm build
```

### Database Management

```bash
# Access PostgreSQL
docker exec -it openradius-postgres psql -U admin -d openradius

# View logs
docker compose logs postgres
docker compose logs keycloak

# Reset database
docker compose down -v
docker compose up -d
```

---

## 🚢 Deployment

### Production Build

**Backend:**
```bash
cd Backend
dotnet publish -c Release -o publish
```

**Frontend:**
```bash
cd Frontend
pnpm build
# Output in dist/
```

### Environment Variables

Set these in your production environment:

**Backend:**
- `ASPNETCORE_ENVIRONMENT=Production`
- `ConnectionStrings__DefaultConnection`
- `Authentication__Schemes__Bearer__ValidIssuer`

**Frontend:**
- `VITE_API_URL=https://api.yourdomin.com`
- `VITE_KEYCLOAK_URL=https://auth.yourdomain.com`

### Docker Production

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow C# coding conventions for backend
- Use TypeScript and ESLint rules for frontend
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [ASP.NET Core](https://dotnet.microsoft.com/) - Backend framework
- [React](https://react.dev/) - Frontend library
- [Keycloak](https://www.keycloak.org/) - Identity and access management
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Finbuckle.MultiTenant](https://www.finbuckle.com/MultiTenant) - Multi-tenancy library
- [TanStack Query](https://tanstack.com/query) - Data fetching

---

## 📞 Support

- 📧 Email: al87mohammed@hotmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/openradius/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/openradius/discussions)

---

<div align="center">

**Built with ❤️ by Ali Al-Estarbadee using .NET 10, React 19, and modern web technologies**

[⬆ Back to Top](#-openradius)

</div>
