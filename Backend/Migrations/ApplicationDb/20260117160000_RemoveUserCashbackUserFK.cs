using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class RemoveUserCashbackUserFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserCashbacks_User_UserId",
                table: "UserCashbacks");

            migrationBuilder.DropIndex(
                name: "IX_UserCashbacks_UserId",
                table: "UserCashbacks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_UserCashbacks_UserId",
                table: "UserCashbacks",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserCashbacks_User_UserId",
                table: "UserCashbacks",
                column: "UserId",
                principalTable: "User",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
