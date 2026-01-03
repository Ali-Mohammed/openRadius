using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.MasterDb
{
    /// <inheritdoc />
    public partial class AddCurrencyToWorkspace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Workspaces",
                type: "text",
                nullable: false,
                defaultValue: "USD");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Workspaces");
        }
    }
}
