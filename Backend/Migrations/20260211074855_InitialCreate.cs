using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<int>(type: "integer", nullable: true),
                    EntityUuid = table.Column<Guid>(type: "uuid", nullable: true),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PreviousData = table.Column<string>(type: "jsonb", nullable: true),
                    NewData = table.Column<string>(type: "jsonb", nullable: true),
                    Changes = table.Column<string>(type: "jsonb", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RequestPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Metadata = table.Column<string>(type: "jsonb", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TargetUserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Automations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    WorkflowJson = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Automations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BillingGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CashbackGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Disabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashbackGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomWallets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    MaxFillLimit = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DailySpendingLimit = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Icon = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CurrentBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AllowNegativeBalance = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomWallets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Dashboards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Icon = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Dashboards", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DebeziumConnectors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ConnectorClass = table.Column<string>(type: "text", nullable: false),
                    DatabaseHostname = table.Column<string>(type: "text", nullable: false),
                    DatabasePort = table.Column<int>(type: "integer", nullable: false),
                    DatabaseUser = table.Column<string>(type: "text", nullable: false),
                    DatabasePassword = table.Column<string>(type: "text", nullable: false),
                    DatabaseName = table.Column<string>(type: "text", nullable: false),
                    DatabaseServerName = table.Column<string>(type: "text", nullable: false),
                    PluginName = table.Column<string>(type: "text", nullable: false),
                    SlotName = table.Column<string>(type: "text", nullable: false),
                    PublicationAutocreateMode = table.Column<string>(type: "text", nullable: false),
                    TableIncludeList = table.Column<string>(type: "text", nullable: false),
                    SnapshotMode = table.Column<string>(type: "text", nullable: false),
                    AdditionalConfig = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DebeziumConnectors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DebeziumSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ConnectUrl = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: true),
                    Password = table.Column<string>(type: "text", nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DebeziumSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationWebhooks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    IntegrationName = table.Column<string>(type: "text", nullable: false),
                    IntegrationType = table.Column<string>(type: "text", nullable: false),
                    CallbackEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    WebhookToken = table.Column<string>(type: "text", nullable: false),
                    WebhookUrl = table.Column<string>(type: "text", nullable: false),
                    RequireAuthentication = table.Column<bool>(type: "boolean", nullable: false),
                    AllowedIpAddresses = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RequestCount = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntegrationWebhooks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MicroserviceApprovals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceName = table.Column<string>(type: "text", nullable: false),
                    MachineId = table.Column<string>(type: "text", nullable: false),
                    ApprovalToken = table.Column<string>(type: "text", nullable: false),
                    MachineName = table.Column<string>(type: "text", nullable: false),
                    Platform = table.Column<string>(type: "text", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: false),
                    IsApproved = table.Column<bool>(type: "boolean", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastConnectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ApprovedBy = table.Column<string>(type: "text", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MicroserviceApprovals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OltDevices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OltDevices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Olts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Hostname = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Vendor = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Model = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AssetTag = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Environment = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ManagementIp = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ManagementVlan = table.Column<int>(type: "integer", nullable: true),
                    LoopbackIp = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MgmtInterface = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SshEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SshPort = table.Column<int>(type: "integer", nullable: false),
                    SshUsername = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SshAuthType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SshPasswordRef = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SshPrivateKeyRef = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SnmpVersion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SnmpPort = table.Column<int>(type: "integer", nullable: false),
                    SnmpTimeoutMs = table.Column<int>(type: "integer", nullable: false),
                    SnmpRetries = table.Column<int>(type: "integer", nullable: false),
                    SnmpCommunityRef = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SnmpV3User = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SnmpV3AuthProtocol = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SnmpV3PrivProtocol = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SnmpV3AuthKeyRef = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SnmpV3PrivKeyRef = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ApiEndpoint = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ApiVersion = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ApiTokenRef = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ApiTimeoutMs = table.Column<int>(type: "integer", nullable: true),
                    LastSnmpPollAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastSshLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UptimeSeconds = table.Column<long>(type: "bigint", nullable: true),
                    CpuUsagePct = table.Column<decimal>(type: "numeric", nullable: true),
                    MemoryUsagePct = table.Column<decimal>(type: "numeric", nullable: true),
                    TemperatureC = table.Column<decimal>(type: "numeric", nullable: true),
                    SiteName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Rack = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    RackUnit = table.Column<int>(type: "integer", nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric", nullable: true),
                    Longitude = table.Column<decimal>(type: "numeric", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Olts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaymentLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Gateway = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReferenceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    GatewayTransactionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RequestData = table.Column<string>(type: "jsonb", nullable: true),
                    ResponseData = table.Column<string>(type: "jsonb", nullable: true),
                    CallbackData = table.Column<string>(type: "jsonb", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ServiceType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Environment = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    WalletTransactionId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaymentMethods",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Settings = table.Column<string>(type: "jsonb", nullable: false),
                    WalletId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentMethods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "radacct",
                columns: table => new
                {
                    radacctid = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    acctsessionid = table.Column<string>(type: "text", nullable: true),
                    acctuniqueid = table.Column<string>(type: "text", nullable: true),
                    username = table.Column<string>(type: "text", nullable: true),
                    realm = table.Column<string>(type: "text", nullable: true),
                    nasipaddress = table.Column<string>(type: "text", nullable: true),
                    nasportid = table.Column<string>(type: "text", nullable: true),
                    nasporttype = table.Column<string>(type: "text", nullable: true),
                    acctstarttime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acctupdatetime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acctstoptime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    acctinterval = table.Column<long>(type: "bigint", nullable: true),
                    acctsessiontime = table.Column<long>(type: "bigint", nullable: true),
                    acctauthentic = table.Column<string>(type: "text", nullable: true),
                    connectinfo_start = table.Column<string>(type: "text", nullable: true),
                    connectinfo_stop = table.Column<string>(type: "text", nullable: true),
                    acctinputoctets = table.Column<long>(type: "bigint", nullable: true),
                    acctoutputoctets = table.Column<long>(type: "bigint", nullable: true),
                    calledstationid = table.Column<string>(type: "text", nullable: true),
                    callingstationid = table.Column<string>(type: "text", nullable: true),
                    acctterminatecause = table.Column<string>(type: "text", nullable: true),
                    servicetype = table.Column<string>(type: "text", nullable: true),
                    framedprotocol = table.Column<string>(type: "text", nullable: true),
                    framedipaddress = table.Column<string>(type: "text", nullable: true),
                    framedipv6address = table.Column<string>(type: "text", nullable: true),
                    framedipv6prefix = table.Column<string>(type: "text", nullable: true),
                    framedinterfaceid = table.Column<string>(type: "text", nullable: true),
                    delegatedipv6prefix = table.Column<string>(type: "text", nullable: true),
                    @class = table.Column<string>(name: "class", type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_radacct", x => x.radacctid);
                });

            migrationBuilder.CreateTable(
                name: "radius_ip_pools",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    start_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    end_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    lease_time = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_radius_ip_pools", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Subscription = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusNasDevices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Nasname = table.Column<string>(type: "text", nullable: false),
                    Shortname = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Secret = table.Column<string>(type: "text", nullable: false),
                    ApiUsername = table.Column<string>(type: "text", nullable: true),
                    ApiPassword = table.Column<string>(type: "text", nullable: true),
                    CoaPort = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Server = table.Column<string>(type: "text", nullable: true),
                    Enabled = table.Column<int>(type: "integer", nullable: false),
                    SiteId = table.Column<int>(type: "integer", nullable: true),
                    HttpPort = table.Column<int>(type: "integer", nullable: false),
                    Monitor = table.Column<int>(type: "integer", nullable: false),
                    PingTime = table.Column<int>(type: "integer", nullable: false),
                    PingLoss = table.Column<int>(type: "integer", nullable: false),
                    IpAccountingEnabled = table.Column<int>(type: "integer", nullable: false),
                    PoolName = table.Column<string>(type: "text", nullable: true),
                    ApiPort = table.Column<int>(type: "integer", nullable: true),
                    SnmpCommunity = table.Column<string>(type: "text", nullable: true),
                    SshUsername = table.Column<string>(type: "text", nullable: true),
                    SshPassword = table.Column<string>(type: "text", nullable: true),
                    SshPort = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusNasDevices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Downrate = table.Column<int>(type: "integer", nullable: false),
                    Uprate = table.Column<int>(type: "integer", nullable: false),
                    Pool = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: false),
                    Monthly = table.Column<int>(type: "integer", nullable: false),
                    BurstEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LimitExpiration = table.Column<bool>(type: "boolean", nullable: false),
                    ExpirationAmount = table.Column<int>(type: "integer", nullable: false),
                    ExpirationUnit = table.Column<int>(type: "integer", nullable: false),
                    SiteId = table.Column<int>(type: "integer", nullable: true),
                    OnlineUsersCount = table.Column<int>(type: "integer", nullable: false),
                    UsersCount = table.Column<int>(type: "integer", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusTags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SasRadiusIntegrations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Url = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    UseHttps = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    MaxItemInPagePerRequest = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SendActivationsToSas = table.Column<bool>(type: "boolean", nullable: false),
                    ActivationMaxRetries = table.Column<int>(type: "integer", nullable: false),
                    ActivationRetryDelayMinutes = table.Column<int>(type: "integer", nullable: false),
                    ActivationUseExponentialBackoff = table.Column<bool>(type: "boolean", nullable: false),
                    ActivationTimeoutSeconds = table.Column<int>(type: "integer", nullable: false),
                    ActivationMaxConcurrency = table.Column<int>(type: "integer", nullable: false),
                    ActivationMethod = table.Column<string>(type: "text", nullable: false),
                    CardStockUserId = table.Column<int>(type: "integer", nullable: true),
                    AllowAnyCardStockUser = table.Column<bool>(type: "boolean", nullable: false),
                    UseFreeCardsOnly = table.Column<bool>(type: "boolean", nullable: false),
                    CheckCardAvailabilityBeforeActivate = table.Column<bool>(type: "boolean", nullable: false),
                    SyncOnlineUsers = table.Column<bool>(type: "boolean", nullable: false),
                    SyncOnlineUsersIntervalMinutes = table.Column<int>(type: "integer", nullable: false),
                    SessionSyncRecordsPerPage = table.Column<int>(type: "integer", nullable: false),
                    UseSas4ForLiveSessions = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SasRadiusIntegrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SessionSyncProgresses",
                columns: table => new
                {
                    SyncId = table.Column<Guid>(type: "uuid", nullable: false),
                    IntegrationId = table.Column<int>(type: "integer", nullable: false),
                    IntegrationName = table.Column<string>(type: "text", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalOnlineUsers = table.Column<int>(type: "integer", nullable: false),
                    ProcessedUsers = table.Column<int>(type: "integer", nullable: false),
                    SuccessfulSyncs = table.Column<int>(type: "integer", nullable: false),
                    FailedSyncs = table.Column<int>(type: "integer", nullable: false),
                    NewSessions = table.Column<int>(type: "integer", nullable: false),
                    UpdatedSessions = table.Column<int>(type: "integer", nullable: false),
                    ProgressPercentage = table.Column<double>(type: "double precision", nullable: false),
                    CurrentMessage = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionSyncProgresses", x => x.SyncId);
                });

            migrationBuilder.CreateTable(
                name: "SyncProgresses",
                columns: table => new
                {
                    SyncId = table.Column<Guid>(type: "uuid", nullable: false),
                    IntegrationId = table.Column<int>(type: "integer", nullable: false),
                    IntegrationName = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentPhase = table.Column<int>(type: "integer", nullable: false),
                    ProfileCurrentPage = table.Column<int>(type: "integer", nullable: false),
                    ProfileTotalPages = table.Column<int>(type: "integer", nullable: false),
                    ProfileTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileNewRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    GroupCurrentPage = table.Column<int>(type: "integer", nullable: false),
                    GroupTotalPages = table.Column<int>(type: "integer", nullable: false),
                    GroupTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    GroupProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    GroupNewRecords = table.Column<int>(type: "integer", nullable: false),
                    GroupUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    GroupFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    ZoneTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    ZoneProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    ZoneNewRecords = table.Column<int>(type: "integer", nullable: false),
                    ZoneUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    ZoneFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    UserCurrentPage = table.Column<int>(type: "integer", nullable: false),
                    UserTotalPages = table.Column<int>(type: "integer", nullable: false),
                    UserTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    UserProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    UserNewRecords = table.Column<int>(type: "integer", nullable: false),
                    UserUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    UserFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    NasCurrentPage = table.Column<int>(type: "integer", nullable: false),
                    NasTotalPages = table.Column<int>(type: "integer", nullable: false),
                    NasTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    NasProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    NasNewRecords = table.Column<int>(type: "integer", nullable: false),
                    NasUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    NasFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    ProgressPercentage = table.Column<double>(type: "double precision", nullable: false),
                    CurrentMessage = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncProgresses", x => x.SyncId);
                });

            migrationBuilder.CreateTable(
                name: "SystemNotifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RecipientUserId = table.Column<int>(type: "integer", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDismissed = table.Column<bool>(type: "boolean", nullable: false),
                    DismissedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActionUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ActionLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReferenceEntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReferenceEntityUuid = table.Column<Guid>(type: "uuid", nullable: true),
                    Metadata = table.Column<string>(type: "jsonb", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemNotifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TablePreferences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TableName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ColumnWidths = table.Column<string>(type: "text", nullable: true),
                    ColumnOrder = table.Column<string>(type: "text", nullable: true),
                    ColumnVisibility = table.Column<string>(type: "text", nullable: true),
                    SortField = table.Column<string>(type: "text", nullable: true),
                    SortDirection = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TablePreferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WebhookLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    WebhookId = table.Column<int>(type: "integer", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    Method = table.Column<string>(type: "text", nullable: false),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    Headers = table.Column<string>(type: "text", nullable: true),
                    RequestBody = table.Column<string>(type: "text", nullable: true),
                    StatusCode = table.Column<int>(type: "integer", nullable: false),
                    ResponseBody = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    Success = table.Column<bool>(type: "boolean", nullable: false),
                    ProcessingTimeMs = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebhookLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Zones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    ParentZoneId = table.Column<int>(type: "integer", nullable: true),
                    SasUserId = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Zones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Zones_Zones_ParentZoneId",
                        column: x => x.ParentZoneId,
                        principalTable: "Zones",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "WorkflowHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    AutomationId = table.Column<int>(type: "integer", nullable: false),
                    WorkflowJson = table.Column<string>(type: "text", nullable: false),
                    NodeCount = table.Column<int>(type: "integer", nullable: false),
                    EdgeCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowHistories_Automations_AutomationId",
                        column: x => x.AutomationId,
                        principalTable: "Automations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingGroupUser",
                columns: table => new
                {
                    GroupId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingGroupUser", x => new { x.GroupId, x.UserId });
                    table.ForeignKey(
                        name: "FK_BillingGroupUser_BillingGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "BillingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CashbackGroupUsers",
                columns: table => new
                {
                    CashbackGroupId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashbackGroupUsers", x => new { x.CashbackGroupId, x.UserId });
                    table.ForeignKey(
                        name: "FK_CashbackGroupUsers_CashbackGroups_CashbackGroupId",
                        column: x => x.CashbackGroupId,
                        principalTable: "CashbackGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Addons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Addons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Addons_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UserWallets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    CurrentBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    MaxFillLimit = table.Column<decimal>(type: "numeric", nullable: true),
                    DailySpendingLimit = table.Column<decimal>(type: "numeric", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    AllowNegativeBalance = table.Column<bool>(type: "boolean", nullable: true),
                    UsesCustomCashbackSetting = table.Column<bool>(type: "boolean", nullable: false),
                    CustomCashbackType = table.Column<string>(type: "text", nullable: true),
                    CustomCashbackCollectionSchedule = table.Column<string>(type: "text", nullable: true),
                    CustomCashbackMinimumCollectionAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    CustomCashbackRequiresApproval = table.Column<bool>(type: "boolean", nullable: true),
                    CustomWalletColor = table.Column<string>(type: "text", nullable: true),
                    CustomWalletIcon = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserWallets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserWallets_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DashboardGlobalFilters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    DashboardId = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Value = table.Column<string>(type: "jsonb", nullable: true),
                    Options = table.Column<string>(type: "jsonb", nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DashboardGlobalFilters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DashboardGlobalFilters_Dashboards_DashboardId",
                        column: x => x.DashboardId,
                        principalTable: "Dashboards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DashboardTabs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    DashboardId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DashboardTabs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DashboardTabs_Dashboards_DashboardId",
                        column: x => x.DashboardId,
                        principalTable: "Dashboards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PonPorts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OltId = table.Column<Guid>(type: "uuid", nullable: false),
                    Slot = table.Column<int>(type: "integer", nullable: false),
                    Port = table.Column<int>(type: "integer", nullable: false),
                    Technology = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaxSplitRatio = table.Column<int>(type: "integer", nullable: true),
                    CurrentSplitRatio = table.Column<int>(type: "integer", nullable: true),
                    TxPowerDbm = table.Column<decimal>(type: "numeric", nullable: true),
                    RxPowerDbm = table.Column<decimal>(type: "numeric", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PonPorts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PonPorts_Olts_OltId",
                        column: x => x.OltId,
                        principalTable: "Olts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PaymentForceCompletions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentLogId = table.Column<int>(type: "integer", nullable: false),
                    PreviousStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Justification = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    DocumentPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DocumentFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DocumentContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DocumentFileSize = table.Column<long>(type: "bigint", nullable: false),
                    AmountCredited = table.Column<decimal>(type: "numeric", nullable: false),
                    Gateway = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentForceCompletions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaymentForceCompletions_PaymentLogs_PaymentLogId",
                        column: x => x.PaymentLogId,
                        principalTable: "PaymentLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsOffer = table.Column<bool>(type: "boolean", nullable: false),
                    Platform = table.Column<string>(type: "text", nullable: true),
                    TotalQuantity = table.Column<int>(type: "integer", nullable: true),
                    UsedQuantity = table.Column<int>(type: "integer", nullable: false),
                    UserType = table.Column<string>(type: "text", nullable: true),
                    ExpirationDays = table.Column<int>(type: "integer", nullable: true),
                    OfferStartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OfferEndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RequiresApproval = table.Column<bool>(type: "boolean", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: false),
                    BillingGroupId = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfiles_BillingGroups_BillingGroupId",
                        column: x => x.BillingGroupId,
                        principalTable: "BillingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BillingProfiles_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RadiusProfileWallets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusProfileWallets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusProfileWallets_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RadiusProfileWallets_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SasActivationLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    IntegrationId = table.Column<int>(type: "integer", nullable: false),
                    IntegrationName = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false),
                    ActivationData = table.Column<string>(type: "text", nullable: false),
                    Pin = table.Column<string>(type: "text", nullable: true),
                    CardSeries = table.Column<string>(type: "text", nullable: true),
                    CardSerialNumber = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    MaxRetries = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    ResponseBody = table.Column<string>(type: "text", nullable: true),
                    ResponseStatusCode = table.Column<int>(type: "integer", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    JobId = table.Column<string>(type: "text", nullable: true),
                    NextRetryAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SasActivationLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SasActivationLogs_SasRadiusIntegrations_IntegrationId",
                        column: x => x.IntegrationId,
                        principalTable: "SasRadiusIntegrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RadiusUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<int>(type: "integer", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: true),
                    Password = table.Column<string>(type: "text", nullable: true),
                    Firstname = table.Column<string>(type: "text", nullable: true),
                    Lastname = table.Column<string>(type: "text", nullable: true),
                    City = table.Column<string>(type: "text", nullable: true),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    ProfileId = table.Column<int>(type: "integer", nullable: true),
                    ProfileBillingId = table.Column<int>(type: "integer", nullable: true),
                    Balance = table.Column<decimal>(type: "numeric", nullable: false),
                    LoanBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    Expiration = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastOnline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ParentId = table.Column<int>(type: "integer", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    StaticIp = table.Column<string>(type: "text", nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Company = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    DeviceSerialNumber = table.Column<string>(type: "text", nullable: true),
                    SimultaneousSessions = table.Column<int>(type: "integer", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    ContractId = table.Column<string>(type: "text", nullable: true),
                    NationalId = table.Column<string>(type: "text", nullable: true),
                    MikrotikIpv6Prefix = table.Column<string>(type: "text", nullable: true),
                    GroupId = table.Column<int>(type: "integer", nullable: true),
                    GpsLat = table.Column<string>(type: "text", nullable: true),
                    GpsLng = table.Column<string>(type: "text", nullable: true),
                    Street = table.Column<string>(type: "text", nullable: true),
                    SiteId = table.Column<int>(type: "integer", nullable: true),
                    PinTries = table.Column<int>(type: "integer", nullable: false),
                    RemainingDays = table.Column<int>(type: "integer", nullable: false),
                    OnlineStatus = table.Column<int>(type: "integer", nullable: false),
                    UsedTraffic = table.Column<long>(type: "bigint", nullable: false),
                    AvailableTraffic = table.Column<long>(type: "bigint", nullable: false),
                    ParentUsername = table.Column<string>(type: "text", nullable: true),
                    DebtDays = table.Column<int>(type: "integer", nullable: false),
                    ZoneId = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusUsers_RadiusGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "RadiusGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusUsers_RadiusProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusUsers_Zones_ZoneId",
                        column: x => x.ZoneId,
                        principalTable: "Zones",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UserZones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ZoneId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserZones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserZones_Zones_ZoneId",
                        column: x => x.ZoneId,
                        principalTable: "Zones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionType = table.Column<string>(type: "text", nullable: false),
                    AmountType = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CashbackStatus = table.Column<string>(type: "text", nullable: true),
                    WalletType = table.Column<string>(type: "text", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    UserWalletId = table.Column<int>(type: "integer", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: true),
                    RadiusUsername = table.Column<string>(type: "text", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileName = table.Column<string>(type: "text", nullable: true),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    BillingProfileName = table.Column<string>(type: "text", nullable: true),
                    BalanceBefore = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "numeric", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    Reference = table.Column<string>(type: "text", nullable: true),
                    PaymentMethod = table.Column<string>(type: "text", nullable: true),
                    RelatedTransactionId = table.Column<int>(type: "integer", nullable: true),
                    TransactionGroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActivationId = table.Column<int>(type: "integer", nullable: true),
                    BillingActivationId = table.Column<int>(type: "integer", nullable: true),
                    Metadata = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transactions_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_Transactions_RelatedTransactionId",
                        column: x => x.RelatedTransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transactions_UserWallets_UserWalletId",
                        column: x => x.UserWalletId,
                        principalTable: "UserWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WalletHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    WalletType = table.Column<string>(type: "text", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    UserWalletId = table.Column<int>(type: "integer", nullable: true),
                    TransactionType = table.Column<string>(type: "text", nullable: false),
                    AmountType = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceBefore = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "numeric", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    Reference = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WalletHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WalletHistories_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WalletHistories_UserWallets_UserWalletId",
                        column: x => x.UserWalletId,
                        principalTable: "UserWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DashboardItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    TabId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    LayoutX = table.Column<int>(type: "integer", nullable: false),
                    LayoutY = table.Column<int>(type: "integer", nullable: false),
                    LayoutW = table.Column<int>(type: "integer", nullable: false),
                    LayoutH = table.Column<int>(type: "integer", nullable: false),
                    Config = table.Column<string>(type: "jsonb", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DashboardItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DashboardItems_DashboardTabs_TabId",
                        column: x => x.TabId,
                        principalTable: "DashboardTabs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Fdts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PonPortId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cabinet = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    UsedPorts = table.Column<int>(type: "integer", nullable: false),
                    SplitRatio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    InstallationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Zone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric", nullable: true),
                    Longitude = table.Column<decimal>(type: "numeric", nullable: true),
                    LastInspectionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextInspectionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fdts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Fdts_PonPorts_PonPortId",
                        column: x => x.PonPortId,
                        principalTable: "PonPorts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingProfileAddons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfileAddons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfileAddons_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingProfileUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AssignedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfileUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfileUsers_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingProfileWallets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    WalletType = table.Column<string>(type: "text", nullable: false),
                    UserWalletId = table.Column<int>(type: "integer", nullable: true),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    Percentage = table.Column<decimal>(type: "numeric", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Direction = table.Column<string>(type: "text", nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfileWallets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfileWallets_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BillingProfileWallets_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BillingProfileWallets_UserWallets_UserWalletId",
                        column: x => x.UserWalletId,
                        principalTable: "UserWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CashbackProfileAmounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    CashbackGroupId = table.Column<int>(type: "integer", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashbackProfileAmounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashbackProfileAmounts_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CashbackProfileAmounts_CashbackGroups_CashbackGroupId",
                        column: x => x.CashbackGroupId,
                        principalTable: "CashbackGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubAgentCashbacks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    SupervisorId = table.Column<int>(type: "integer", nullable: false),
                    SubAgentId = table.Column<int>(type: "integer", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubAgentCashbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubAgentCashbacks_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserCashbacks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCashbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserCashbacks_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RadiusCustomAttributes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    AttributeName = table.Column<string>(type: "text", nullable: false),
                    AttributeValue = table.Column<string>(type: "text", nullable: false),
                    LinkType = table.Column<string>(type: "text", nullable: false),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusCustomAttributes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusCustomAttributes_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RadiusCustomAttributes_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "RadiusIpReservations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    IpAddress = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusIpReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusIpReservations_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "RadiusUserHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Changes = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    OldValue = table.Column<string>(type: "text", nullable: true),
                    NewValue = table.Column<string>(type: "text", nullable: true),
                    PerformedBy = table.Column<string>(type: "text", nullable: true),
                    PerformedById = table.Column<int>(type: "integer", nullable: true),
                    PerformedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    UserAgent = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusUserHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusUserHistories_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RadiusUserTags",
                columns: table => new
                {
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    RadiusTagId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusUserTags", x => new { x.RadiusUserId, x.RadiusTagId });
                    table.ForeignKey(
                        name: "FK_RadiusUserTags_RadiusTags_RadiusTagId",
                        column: x => x.RadiusTagId,
                        principalTable: "RadiusTags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RadiusUserTags_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingActivations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    BillingProfileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    RadiusUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ActionById = table.Column<int>(type: "integer", nullable: true),
                    ActionByUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ActionForId = table.Column<int>(type: "integer", nullable: true),
                    ActionForUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IsActionBehalf = table.Column<bool>(type: "boolean", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    CashbackAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    ActivationType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ActivationStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PreviousExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NewExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DurationDays = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    TransactionId = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    WalletDistribution = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessingStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingActivations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingActivations_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_BillingActivations_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TransactionComments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: false),
                    Tags = table.Column<string>(type: "text", nullable: true),
                    Attachments = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransactionComments_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TransactionHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Changes = table.Column<string>(type: "text", nullable: true),
                    PerformedBy = table.Column<string>(type: "text", nullable: false),
                    PerformedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransactionHistories_Transactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "Transactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Fats",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FdtId = table.Column<Guid>(type: "uuid", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    UsedPorts = table.Column<int>(type: "integer", nullable: false),
                    Installation = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    CoverageRadiusM = table.Column<int>(type: "integer", nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric", nullable: true),
                    Longitude = table.Column<decimal>(type: "numeric", nullable: true),
                    LastInspectionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fats", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Fats_Fdts_FdtId",
                        column: x => x.FdtId,
                        principalTable: "Fdts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RadiusActivations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionById = table.Column<int>(type: "integer", nullable: true),
                    ActionByUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ActionForId = table.Column<int>(type: "integer", nullable: true),
                    ActionForUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IsActionBehalf = table.Column<bool>(type: "boolean", nullable: false),
                    BillingActivationId = table.Column<int>(type: "integer", nullable: false),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    RadiusUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PreviousRadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    PreviousBillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    PreviousExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CurrentExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PreviousBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    NewBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ApiStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ApiStatusCode = table.Column<int>(type: "integer", nullable: true),
                    ApiStatusMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ApiResponse = table.Column<string>(type: "text", nullable: true),
                    ExternalReferenceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransactionId = table.Column<int>(type: "integer", nullable: true),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DurationDays = table.Column<int>(type: "integer", nullable: true),
                    ProfileChangeType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ScheduledProfileChangeDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    LastRetryAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusActivations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                        column: x => x.BillingActivationId,
                        principalTable: "BillingActivations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_BillingProfiles_PreviousBillingProfileId",
                        column: x => x.PreviousBillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_RadiusProfiles_PreviousRadiusProfileId",
                        column: x => x.PreviousRadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FatPorts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FatId = table.Column<Guid>(type: "uuid", nullable: false),
                    PortNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubscriberId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FatPorts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FatPorts_Fats_FatId",
                        column: x => x.FatId,
                        principalTable: "Fats",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Addons_CustomWalletId",
                table: "Addons",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Action",
                table: "AuditLogs",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Category",
                table: "AuditLogs",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Category_Action_CreatedAt",
                table: "AuditLogs",
                columns: new[] { "Category", "Action", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CorrelationId",
                table: "AuditLogs",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedAt",
                table: "AuditLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedBy",
                table: "AuditLogs",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedBy_CreatedAt",
                table: "AuditLogs",
                columns: new[] { "CreatedBy", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType",
                table: "AuditLogs",
                column: "EntityType");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType_EntityUuid",
                table: "AuditLogs",
                columns: new[] { "EntityType", "EntityUuid" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityUuid",
                table: "AuditLogs",
                column: "EntityUuid");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Status",
                table: "AuditLogs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TargetUserId",
                table: "AuditLogs",
                column: "TargetUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Uuid",
                table: "AuditLogs",
                column: "Uuid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_ActionById",
                table: "BillingActivations",
                column: "ActionById");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_ActivationStatus",
                table: "BillingActivations",
                column: "ActivationStatus");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_ActivationType",
                table: "BillingActivations",
                column: "ActivationType");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_BillingProfileId",
                table: "BillingActivations",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_CreatedAt",
                table: "BillingActivations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_RadiusUserId",
                table: "BillingActivations",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_RadiusUserId_CreatedAt",
                table: "BillingActivations",
                columns: new[] { "RadiusUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_TransactionId",
                table: "BillingActivations",
                column: "TransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroups_IsActive",
                table: "BillingGroups",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroups_Name",
                table: "BillingGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroupUser_UserId",
                table: "BillingGroupUser",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileAddons_BillingProfileId",
                table: "BillingProfileAddons",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_BillingGroupId",
                table: "BillingProfiles",
                column: "BillingGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_Name",
                table: "BillingProfiles",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_RadiusProfileId",
                table: "BillingProfiles",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileUsers_BillingProfileId_UserId",
                table: "BillingProfileUsers",
                columns: new[] { "BillingProfileId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileWallets_BillingProfileId",
                table: "BillingProfileWallets",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileWallets_CustomWalletId",
                table: "BillingProfileWallets",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileWallets_UserWalletId",
                table: "BillingProfileWallets",
                column: "UserWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_DeletedAt",
                table: "CashbackGroups",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_Disabled",
                table: "CashbackGroups",
                column: "Disabled");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_Name",
                table: "CashbackGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroupUsers_UserId",
                table: "CashbackGroupUsers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackProfileAmounts_BillingProfileId",
                table: "CashbackProfileAmounts",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackProfileAmounts_CashbackGroupId_BillingProfileId",
                table: "CashbackProfileAmounts",
                columns: new[] { "CashbackGroupId", "BillingProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_Name",
                table: "CustomWallets",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_Status",
                table: "CustomWallets",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_Type",
                table: "CustomWallets",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardGlobalFilters_DashboardId",
                table: "DashboardGlobalFilters",
                column: "DashboardId");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardItems_TabId",
                table: "DashboardItems",
                column: "TabId");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardTabs_DashboardId",
                table: "DashboardTabs",
                column: "DashboardId");

            migrationBuilder.CreateIndex(
                name: "IX_FatPorts_FatId",
                table: "FatPorts",
                column: "FatId");

            migrationBuilder.CreateIndex(
                name: "IX_Fats_FdtId",
                table: "Fats",
                column: "FdtId");

            migrationBuilder.CreateIndex(
                name: "IX_Fdts_PonPortId",
                table: "Fdts",
                column: "PonPortId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentForceCompletions_PaymentLogId",
                table: "PaymentForceCompletions",
                column: "PaymentLogId");

            migrationBuilder.CreateIndex(
                name: "IX_PonPorts_OltId",
                table: "PonPorts",
                column: "OltId");

            migrationBuilder.CreateIndex(
                name: "IX_radius_ip_pools_name",
                table: "radius_ip_pools",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_ApiStatus",
                table: "RadiusActivations",
                column: "ApiStatus");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_BillingActivationId",
                table: "RadiusActivations",
                column: "BillingActivationId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_BillingProfileId",
                table: "RadiusActivations",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_CreatedAt",
                table: "RadiusActivations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_PreviousBillingProfileId",
                table: "RadiusActivations",
                column: "PreviousBillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_PreviousRadiusProfileId",
                table: "RadiusActivations",
                column: "PreviousRadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_RadiusProfileId",
                table: "RadiusActivations",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_RadiusUserId",
                table: "RadiusActivations",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_RadiusUserId_CreatedAt",
                table: "RadiusActivations",
                columns: new[] { "RadiusUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_Status",
                table: "RadiusActivations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_Type",
                table: "RadiusActivations",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusCustomAttributes_RadiusProfileId",
                table: "RadiusCustomAttributes",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusCustomAttributes_RadiusUserId",
                table: "RadiusCustomAttributes",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_DeletedAt",
                table: "RadiusIpReservations",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_IpAddress",
                table: "RadiusIpReservations",
                column: "IpAddress");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_IpAddress_DeletedAt",
                table: "RadiusIpReservations",
                columns: new[] { "IpAddress", "DeletedAt" },
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_RadiusUserId",
                table: "RadiusIpReservations",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_RadiusUserId_DeletedAt",
                table: "RadiusIpReservations",
                columns: new[] { "RadiusUserId", "DeletedAt" },
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_Nasname",
                table: "RadiusNasDevices",
                column: "Nasname");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_Shortname",
                table: "RadiusNasDevices",
                column: "Shortname");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusProfileWallets_CustomWalletId",
                table: "RadiusProfileWallets",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusProfileWallets_RadiusProfileId",
                table: "RadiusProfileWallets",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusTags_Title",
                table: "RadiusTags",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUserHistories_RadiusUserId",
                table: "RadiusUserHistories",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_GroupId",
                table: "RadiusUsers",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_ProfileId",
                table: "RadiusUsers",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_ZoneId",
                table: "RadiusUsers",
                column: "ZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUserTags_RadiusTagId",
                table: "RadiusUserTags",
                column: "RadiusTagId");

            migrationBuilder.CreateIndex(
                name: "IX_SasActivationLogs_IntegrationId",
                table: "SasActivationLogs",
                column: "IntegrationId");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_BillingProfileId",
                table: "SubAgentCashbacks",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_DeletedAt",
                table: "SubAgentCashbacks",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_SubAgentId",
                table: "SubAgentCashbacks",
                column: "SubAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_SupervisorId",
                table: "SubAgentCashbacks",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_SupervisorId_SubAgentId_BillingProfileId",
                table: "SubAgentCashbacks",
                columns: new[] { "SupervisorId", "SubAgentId", "BillingProfileId" },
                unique: true,
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_CreatedAt",
                table: "SystemNotifications",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_ExpiresAt",
                table: "SystemNotifications",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_IsDismissed",
                table: "SystemNotifications",
                column: "IsDismissed");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_IsRead",
                table: "SystemNotifications",
                column: "IsRead");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_RecipientUserId",
                table: "SystemNotifications",
                column: "RecipientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_RecipientUserId_IsDismissed",
                table: "SystemNotifications",
                columns: new[] { "RecipientUserId", "IsDismissed" });

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_RecipientUserId_IsRead_CreatedAt",
                table: "SystemNotifications",
                columns: new[] { "RecipientUserId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_ReferenceEntityUuid",
                table: "SystemNotifications",
                column: "ReferenceEntityUuid");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_Severity",
                table: "SystemNotifications",
                column: "Severity");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_Type",
                table: "SystemNotifications",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_SystemNotifications_Uuid",
                table: "SystemNotifications",
                column: "Uuid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TablePreferences_UserId_TableName",
                table: "TablePreferences",
                columns: new[] { "UserId", "TableName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransactionComments_CreatedAt",
                table: "TransactionComments",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionComments_TransactionId",
                table: "TransactionComments",
                column: "TransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionHistories_Action",
                table: "TransactionHistories",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionHistories_PerformedAt",
                table: "TransactionHistories",
                column: "PerformedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionHistories_TransactionId",
                table: "TransactionHistories",
                column: "TransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CashbackStatus",
                table: "Transactions",
                column: "CashbackStatus");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CreatedAt",
                table: "Transactions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CustomWalletId",
                table: "Transactions",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DeletedAt",
                table: "Transactions",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_RelatedTransactionId",
                table: "Transactions",
                column: "RelatedTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_Status",
                table: "Transactions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_TransactionGroupId",
                table: "Transactions",
                column: "TransactionGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_TransactionType",
                table: "Transactions",
                column: "TransactionType");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId",
                table: "Transactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserWalletId",
                table: "Transactions",
                column: "UserWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_WalletType",
                table: "Transactions",
                column: "WalletType");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_WalletType_TransactionType_CashbackStatus_Dele~",
                table: "Transactions",
                columns: new[] { "WalletType", "TransactionType", "CashbackStatus", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserCashbacks_BillingProfileId",
                table: "UserCashbacks",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_CustomWalletId",
                table: "UserWallets",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_Status",
                table: "UserWallets",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_UserId",
                table: "UserWallets",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_UserId_CustomWalletId",
                table: "UserWallets",
                columns: new[] { "UserId", "CustomWalletId" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_UserZones_UserId_ZoneId",
                table: "UserZones",
                columns: new[] { "UserId", "ZoneId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserZones_ZoneId",
                table: "UserZones",
                column: "ZoneId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_CreatedAt",
                table: "WalletHistories",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_CustomWalletId",
                table: "WalletHistories",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_TransactionType",
                table: "WalletHistories",
                column: "TransactionType");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_UserId",
                table: "WalletHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_UserWalletId",
                table: "WalletHistories",
                column: "UserWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_WalletType",
                table: "WalletHistories",
                column: "WalletType");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowHistories_AutomationId",
                table: "WorkflowHistories",
                column: "AutomationId");

            migrationBuilder.CreateIndex(
                name: "IX_Zones_Name",
                table: "Zones",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Zones_ParentZoneId",
                table: "Zones",
                column: "ParentZoneId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Addons");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "BillingGroupUser");

            migrationBuilder.DropTable(
                name: "BillingProfileAddons");

            migrationBuilder.DropTable(
                name: "BillingProfileUsers");

            migrationBuilder.DropTable(
                name: "BillingProfileWallets");

            migrationBuilder.DropTable(
                name: "CashbackGroupUsers");

            migrationBuilder.DropTable(
                name: "CashbackProfileAmounts");

            migrationBuilder.DropTable(
                name: "DashboardGlobalFilters");

            migrationBuilder.DropTable(
                name: "DashboardItems");

            migrationBuilder.DropTable(
                name: "DebeziumConnectors");

            migrationBuilder.DropTable(
                name: "DebeziumSettings");

            migrationBuilder.DropTable(
                name: "FatPorts");

            migrationBuilder.DropTable(
                name: "IntegrationWebhooks");

            migrationBuilder.DropTable(
                name: "MicroserviceApprovals");

            migrationBuilder.DropTable(
                name: "OltDevices");

            migrationBuilder.DropTable(
                name: "PaymentForceCompletions");

            migrationBuilder.DropTable(
                name: "PaymentMethods");

            migrationBuilder.DropTable(
                name: "radacct");

            migrationBuilder.DropTable(
                name: "radius_ip_pools");

            migrationBuilder.DropTable(
                name: "RadiusActivations");

            migrationBuilder.DropTable(
                name: "RadiusCustomAttributes");

            migrationBuilder.DropTable(
                name: "RadiusIpReservations");

            migrationBuilder.DropTable(
                name: "RadiusNasDevices");

            migrationBuilder.DropTable(
                name: "RadiusProfileWallets");

            migrationBuilder.DropTable(
                name: "RadiusUserHistories");

            migrationBuilder.DropTable(
                name: "RadiusUserTags");

            migrationBuilder.DropTable(
                name: "SasActivationLogs");

            migrationBuilder.DropTable(
                name: "SessionSyncProgresses");

            migrationBuilder.DropTable(
                name: "SubAgentCashbacks");

            migrationBuilder.DropTable(
                name: "SyncProgresses");

            migrationBuilder.DropTable(
                name: "SystemNotifications");

            migrationBuilder.DropTable(
                name: "TablePreferences");

            migrationBuilder.DropTable(
                name: "TransactionComments");

            migrationBuilder.DropTable(
                name: "TransactionHistories");

            migrationBuilder.DropTable(
                name: "UserCashbacks");

            migrationBuilder.DropTable(
                name: "UserZones");

            migrationBuilder.DropTable(
                name: "WalletHistories");

            migrationBuilder.DropTable(
                name: "WebhookLogs");

            migrationBuilder.DropTable(
                name: "WorkflowHistories");

            migrationBuilder.DropTable(
                name: "CashbackGroups");

            migrationBuilder.DropTable(
                name: "DashboardTabs");

            migrationBuilder.DropTable(
                name: "Fats");

            migrationBuilder.DropTable(
                name: "PaymentLogs");

            migrationBuilder.DropTable(
                name: "BillingActivations");

            migrationBuilder.DropTable(
                name: "RadiusTags");

            migrationBuilder.DropTable(
                name: "RadiusUsers");

            migrationBuilder.DropTable(
                name: "SasRadiusIntegrations");

            migrationBuilder.DropTable(
                name: "Automations");

            migrationBuilder.DropTable(
                name: "Dashboards");

            migrationBuilder.DropTable(
                name: "Fdts");

            migrationBuilder.DropTable(
                name: "BillingProfiles");

            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropTable(
                name: "RadiusGroups");

            migrationBuilder.DropTable(
                name: "Zones");

            migrationBuilder.DropTable(
                name: "PonPorts");

            migrationBuilder.DropTable(
                name: "BillingGroups");

            migrationBuilder.DropTable(
                name: "RadiusProfiles");

            migrationBuilder.DropTable(
                name: "UserWallets");

            migrationBuilder.DropTable(
                name: "Olts");

            migrationBuilder.DropTable(
                name: "CustomWallets");
        }
    }
}
