using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddUserWalletIdToBillingProfileWallets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserWalletId",
                table: "BillingProfileWallets",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileWallets_CustomWalletId",
                table: "BillingProfileWallets",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileWallets_UserWalletId",
                table: "BillingProfileWallets",
                column: "UserWalletId");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingProfileWallets_CustomWallets_CustomWalletId",
                table: "BillingProfileWallets",
                column: "CustomWalletId",
                principalTable: "CustomWallets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_BillingProfileWallets_UserWallets_UserWalletId",
                table: "BillingProfileWallets",
                column: "UserWalletId",
                principalTable: "UserWallets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingProfileWallets_CustomWallets_CustomWalletId",
                table: "BillingProfileWallets");

            migrationBuilder.DropForeignKey(
                name: "FK_BillingProfileWallets_UserWallets_UserWalletId",
                table: "BillingProfileWallets");

            migrationBuilder.DropIndex(
                name: "IX_BillingProfileWallets_CustomWalletId",
                table: "BillingProfileWallets");

            migrationBuilder.DropIndex(
                name: "IX_BillingProfileWallets_UserWalletId",
                table: "BillingProfileWallets");

            migrationBuilder.DropColumn(
                name: "UserWalletId",
                table: "BillingProfileWallets");
        }
    }
}
