using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddRadiusAndBillingFieldsToTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BillingProfileId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillingProfileName",
                table: "Transactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RadiusProfileId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RadiusProfileName",
                table: "Transactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RadiusUserId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RadiusUsername",
                table: "Transactions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BillingProfileId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "BillingProfileName",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RadiusProfileId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RadiusProfileName",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RadiusUserId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RadiusUsername",
                table: "Transactions");
        }
    }
}
