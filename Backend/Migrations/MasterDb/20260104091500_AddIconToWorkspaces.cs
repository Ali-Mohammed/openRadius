using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.MasterDb
{
    /// <inheritdoc />
    public partial class AddIconToWorkspaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "Workspaces",
                type: "text",
                nullable: false,
                defaultValue: "Building2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Icon",
                table: "Workspaces");
        }
    }
}
