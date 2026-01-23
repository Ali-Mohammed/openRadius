using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddBillingActivationIdToRadiusActivationAndTransaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BillingActivationId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BillingActivationId",
                table: "RadiusActivations",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_BillingActivationId",
                table: "RadiusActivations",
                column: "BillingActivationId");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                table: "RadiusActivations",
                column: "BillingActivationId",
                principalTable: "BillingActivations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                table: "RadiusActivations");

            migrationBuilder.DropIndex(
                name: "IX_RadiusActivations_BillingActivationId",
                table: "RadiusActivations");

            migrationBuilder.DropColumn(
                name: "BillingActivationId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "BillingActivationId",
                table: "RadiusActivations");
        }
    }
}
