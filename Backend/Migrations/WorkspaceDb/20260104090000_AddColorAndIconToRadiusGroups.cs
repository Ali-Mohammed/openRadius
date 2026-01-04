using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddColorAndIconToRadiusGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "RadiusGroups",
                type: "text",
                nullable: false,
                defaultValue: "#3b82f6");

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "RadiusGroups",
                type: "text",
                nullable: false,
                defaultValue: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "RadiusGroups");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "RadiusGroups");
        }
    }
}
