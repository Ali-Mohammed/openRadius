using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.MasterDb
{
    /// <inheritdoc />
    public partial class AddIconAndColorToRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Roles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "Roles",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "Roles");
        }
    }
}
