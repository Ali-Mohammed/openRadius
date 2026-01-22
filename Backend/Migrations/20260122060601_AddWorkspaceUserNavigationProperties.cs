using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkspaceUserNavigationProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_CreatedBy",
                table: "Workspaces",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_DeletedBy",
                table: "Workspaces",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_UpdatedBy",
                table: "Workspaces",
                column: "UpdatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Workspaces_Users_CreatedBy",
                table: "Workspaces",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Workspaces_Users_DeletedBy",
                table: "Workspaces",
                column: "DeletedBy",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Workspaces_Users_UpdatedBy",
                table: "Workspaces",
                column: "UpdatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Workspaces_Users_CreatedBy",
                table: "Workspaces");

            migrationBuilder.DropForeignKey(
                name: "FK_Workspaces_Users_DeletedBy",
                table: "Workspaces");

            migrationBuilder.DropForeignKey(
                name: "FK_Workspaces_Users_UpdatedBy",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_Workspaces_CreatedBy",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_Workspaces_DeletedBy",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_Workspaces_UpdatedBy",
                table: "Workspaces");
        }
    }
}
