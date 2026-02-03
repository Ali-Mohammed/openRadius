using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddSyncOnlineUsersSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SyncOnlineUsers",
                table: "SasRadiusIntegrations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SyncOnlineUsersIntervalMinutes",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: false,
                defaultValue: 5);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SyncOnlineUsers",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "SyncOnlineUsersIntervalMinutes",
                table: "SasRadiusIntegrations");
        }
    }
}
