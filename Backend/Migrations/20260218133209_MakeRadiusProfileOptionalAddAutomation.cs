using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class MakeRadiusProfileOptionalAddAutomation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "RadiusProfileId",
                table: "BillingProfiles",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "AutomationId",
                table: "BillingProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_AutomationId",
                table: "BillingProfiles",
                column: "AutomationId");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingProfiles_Automations_AutomationId",
                table: "BillingProfiles",
                column: "AutomationId",
                principalTable: "Automations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingProfiles_Automations_AutomationId",
                table: "BillingProfiles");

            migrationBuilder.DropIndex(
                name: "IX_BillingProfiles_AutomationId",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "AutomationId",
                table: "BillingProfiles");

            migrationBuilder.AlterColumn<int>(
                name: "RadiusProfileId",
                table: "BillingProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
