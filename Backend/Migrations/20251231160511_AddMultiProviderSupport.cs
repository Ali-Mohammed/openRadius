using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiProviderSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "OidcSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "OidcSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "OidcSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "OidcSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "OidcSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProviderName",
                table: "OidcSettings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "OidcSettings");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "OidcSettings");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "OidcSettings");

            migrationBuilder.DropColumn(
                name: "IsDefault",
                table: "OidcSettings");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "OidcSettings");

            migrationBuilder.DropColumn(
                name: "ProviderName",
                table: "OidcSettings");
        }
    }
}
