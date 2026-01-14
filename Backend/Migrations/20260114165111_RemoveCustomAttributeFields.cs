using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCustomAttributeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttributeType",
                table: "RadiusCustomAttributes");

            migrationBuilder.DropColumn(
                name: "Operator",
                table: "RadiusCustomAttributes");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "RadiusCustomAttributes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AttributeType",
                table: "RadiusCustomAttributes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Operator",
                table: "RadiusCustomAttributes",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "RadiusCustomAttributes",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
