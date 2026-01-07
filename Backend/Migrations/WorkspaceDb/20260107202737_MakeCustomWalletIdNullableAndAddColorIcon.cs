using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class MakeCustomWalletIdNullableAndAddColorIcon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "CustomWalletId",
                table: "UserWallets",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "CustomWalletColor",
                table: "UserWallets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomWalletIcon",
                table: "UserWallets",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomWalletColor",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "CustomWalletIcon",
                table: "UserWallets");

            migrationBuilder.AlterColumn<int>(
                name: "CustomWalletId",
                table: "UserWallets",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
