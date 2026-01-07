using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class ChangeIsCreditToAmountType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsCredit",
                table: "WalletHistories");

            migrationBuilder.DropColumn(
                name: "IsCredit",
                table: "Transactions");

            migrationBuilder.AddColumn<string>(
                name: "AmountType",
                table: "WalletHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AmountType",
                table: "Transactions",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AmountType",
                table: "WalletHistories");

            migrationBuilder.DropColumn(
                name: "AmountType",
                table: "Transactions");

            migrationBuilder.AddColumn<bool>(
                name: "IsCredit",
                table: "WalletHistories",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsCredit",
                table: "Transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
