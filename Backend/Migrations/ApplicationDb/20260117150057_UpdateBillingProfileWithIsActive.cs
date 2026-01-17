using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class UpdateBillingProfileWithIsActive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "BillingProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "BillingProfiles");
        }
    }
}
