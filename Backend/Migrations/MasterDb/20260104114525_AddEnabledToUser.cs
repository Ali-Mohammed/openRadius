using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.MasterDb
{
    /// <inheritdoc />
    public partial class AddEnabledToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Enabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // Update any existing users that might have been set to false
            migrationBuilder.Sql("UPDATE \"Users\" SET \"Enabled\" = true WHERE \"Enabled\" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Enabled",
                table: "Users");
        }
    }
}
