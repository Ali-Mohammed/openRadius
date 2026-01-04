using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddRadiusNas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RadiusNasDevices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
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
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusNasDevices", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_Nasname",
                table: "RadiusNasDevices",
                column: "Nasname");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_Shortname",
                table: "RadiusNasDevices",
                column: "Shortname");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusNasDevices");
        }
    }
}
