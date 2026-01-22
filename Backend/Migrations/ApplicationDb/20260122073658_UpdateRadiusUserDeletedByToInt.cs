using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class UpdateRadiusUserDeletedByToInt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop the old column and recreate it as integer
            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "RadiusUsers");
            
            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "RadiusUsers",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "RadiusUsers");
            
            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "RadiusUsers",
                type: "text",
                nullable: true);
        }
    }
}
