using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddIconToRadiusTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "RadiusTags",
                type: "text",
                nullable: false,
                defaultValue: "Tag");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Icon",
                table: "RadiusTags");
        }
    }
}
