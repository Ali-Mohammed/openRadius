using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddZoneSyncTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ZoneFailedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ZoneNewRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ZoneProcessedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ZoneTotalRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ZoneUpdatedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ZoneFailedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "ZoneNewRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "ZoneProcessedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "ZoneTotalRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "ZoneUpdatedRecords",
                table: "SyncProgresses");
        }
    }
}
