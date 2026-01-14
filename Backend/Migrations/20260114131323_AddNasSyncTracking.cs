using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddNasSyncTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NasCurrentPage",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NasFailedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NasNewRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NasProcessedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NasTotalPages",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NasTotalRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NasUpdatedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NasCurrentPage",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "NasFailedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "NasNewRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "NasProcessedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "NasTotalPages",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "NasTotalRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "NasUpdatedRecords",
                table: "SyncProgresses");
        }
    }
}
