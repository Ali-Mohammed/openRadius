using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddActivationQueueSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ActivationMaxRetries",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ActivationRetryDelayMinutes",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ActivationTimeoutSeconds",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "ActivationUseExponentialBackoff",
                table: "SasRadiusIntegrations",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActivationMaxRetries",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "ActivationRetryDelayMinutes",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "ActivationTimeoutSeconds",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "ActivationUseExponentialBackoff",
                table: "SasRadiusIntegrations");
        }
    }
}
