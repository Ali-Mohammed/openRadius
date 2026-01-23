using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class MakeRadiusActivationIdNullableInBillingActivations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_RadiusActivations_RadiusActivationId",
                table: "BillingActivations");

            migrationBuilder.AlterColumn<int>(
                name: "RadiusActivationId",
                table: "BillingActivations",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_RadiusActivations_RadiusActivationId",
                table: "BillingActivations",
                column: "RadiusActivationId",
                principalTable: "RadiusActivations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_RadiusActivations_RadiusActivationId",
                table: "BillingActivations");

            migrationBuilder.AlterColumn<int>(
                name: "RadiusActivationId",
                table: "BillingActivations",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_RadiusActivations_RadiusActivationId",
                table: "BillingActivations",
                column: "RadiusActivationId",
                principalTable: "RadiusActivations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
