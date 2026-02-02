using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddUseSas4ForLiveSessionsToSasRadiusIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SessionSyncLogs");

            migrationBuilder.AddColumn<int>(
                name: "NewSessions",
                table: "SessionSyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedSessions",
                table: "SessionSyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "UseSas4ForLiveSessions",
                table: "SasRadiusIntegrations",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewSessions",
                table: "SessionSyncProgresses");

            migrationBuilder.DropColumn(
                name: "UpdatedSessions",
                table: "SessionSyncProgresses");

            migrationBuilder.DropColumn(
                name: "UseSas4ForLiveSessions",
                table: "SasRadiusIntegrations");

            migrationBuilder.CreateTable(
                name: "SessionSyncLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    FailedUsers = table.Column<int>(type: "integer", nullable: false),
                    IntegrationId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SyncId = table.Column<Guid>(type: "uuid", nullable: false),
                    SyncedUsers = table.Column<int>(type: "integer", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalUsers = table.Column<int>(type: "integer", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionSyncLogs", x => x.Id);
                });
        }
    }
}
