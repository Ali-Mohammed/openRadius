using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class RemoveWorkspaceIdFromRadiusCustomAttributes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "RadiusCustomAttributes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WorkspaceId",
                table: "RadiusCustomAttributes",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
