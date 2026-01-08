using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class UpdateAddonModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Addons_CustomWallets_CustomWalletId",
                table: "Addons");

            migrationBuilder.AlterColumn<int>(
                name: "CustomWalletId",
                table: "Addons",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddForeignKey(
                name: "FK_Addons_CustomWallets_CustomWalletId",
                table: "Addons",
                column: "CustomWalletId",
                principalTable: "CustomWallets",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Addons_CustomWallets_CustomWalletId",
                table: "Addons");

            migrationBuilder.AlterColumn<int>(
                name: "CustomWalletId",
                table: "Addons",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Addons_CustomWallets_CustomWalletId",
                table: "Addons",
                column: "CustomWalletId",
                principalTable: "CustomWallets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
