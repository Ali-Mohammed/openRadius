using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddFiberNetworkTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Olts", x => x.Id);
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
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
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
                name: "FatPorts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FatId = table.Column<Guid>(type: "uuid", nullable: false),
                    PortNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubscriberId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
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
                name: "IX_PonPorts_OltId",
                table: "PonPorts",
                column: "OltId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FatPorts");

            migrationBuilder.DropTable(
                name: "Fats");

            migrationBuilder.DropTable(
                name: "Fdts");

            migrationBuilder.DropTable(
                name: "PonPorts");

            migrationBuilder.DropTable(
                name: "Olts");
        }
    }
}
