using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddAdvancedActivationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ActivationMethod",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "AllowAnyCardStockUser",
                table: "SasRadiusIntegrations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CardStockUserId",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UseFreeCardsOnly",
                table: "SasRadiusIntegrations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CardSerialNumber",
                table: "SasActivationLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CardSeries",
                table: "SasActivationLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Pin",
                table: "SasActivationLogs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActivationMethod",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "AllowAnyCardStockUser",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "CardStockUserId",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "UseFreeCardsOnly",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "CardSerialNumber",
                table: "SasActivationLogs");

            migrationBuilder.DropColumn(
                name: "CardSeries",
                table: "SasActivationLogs");

            migrationBuilder.DropColumn(
                name: "Pin",
                table: "SasActivationLogs");
        }
    }
}
