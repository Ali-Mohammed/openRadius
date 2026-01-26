using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class RemoveWorkspaceIdFromPaymentMethods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "PaymentMethods");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WorkspaceId",
                table: "PaymentMethods",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
