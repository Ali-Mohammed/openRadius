using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddActivationMethodToIntegration : Migration
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
        }
    }
}
