using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddHierarchicalZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ParentZoneId",
                table: "Zones",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                table: "Workspace",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Zones_ParentZoneId",
                table: "Zones",
                column: "ParentZoneId");

            migrationBuilder.AddForeignKey(
                name: "FK_Zones_Zones_ParentZoneId",
                table: "Zones",
                column: "ParentZoneId",
                principalTable: "Zones",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Zones_Zones_ParentZoneId",
                table: "Zones");

            migrationBuilder.DropIndex(
                name: "IX_Zones_ParentZoneId",
                table: "Zones");

            migrationBuilder.DropColumn(
                name: "ParentZoneId",
                table: "Zones");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                table: "Workspace");
        }
    }
}
