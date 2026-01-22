using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserNavigationPropertiesToAllModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_BackupHistories_CreatedBy",
                table: "BackupHistories",
                column: "CreatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_BackupHistories_Users_CreatedBy",
                table: "BackupHistories",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BackupHistories_Users_CreatedBy",
                table: "BackupHistories");

            migrationBuilder.DropIndex(
                name: "IX_BackupHistories_CreatedBy",
                table: "BackupHistories");
        }
    }
}
