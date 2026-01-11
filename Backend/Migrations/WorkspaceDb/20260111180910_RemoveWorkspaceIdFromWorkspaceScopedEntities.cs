using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class RemoveWorkspaceIdFromWorkspaceScopedEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "RadiusProfiles");

            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "RadiusNasDevices");

            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "RadiusGroups");

            migrationBuilder.DropColumn(
                name: "workspace_id",
                table: "radius_ip_pools");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WorkspaceId",
                table: "RadiusProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WorkspaceId",
                table: "RadiusNasDevices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WorkspaceId",
                table: "RadiusGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "workspace_id",
                table: "radius_ip_pools",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
