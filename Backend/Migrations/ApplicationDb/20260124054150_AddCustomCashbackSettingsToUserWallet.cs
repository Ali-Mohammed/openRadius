using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddCustomCashbackSettingsToUserWallet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomCashbackCollectionSchedule",
                table: "UserWallets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CustomCashbackMinimumCollectionAmount",
                table: "UserWallets",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CustomCashbackRequiresApproval",
                table: "UserWallets",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomCashbackType",
                table: "UserWallets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UsesCustomCashbackSetting",
                table: "UserWallets",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomCashbackCollectionSchedule",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "CustomCashbackMinimumCollectionAmount",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "CustomCashbackRequiresApproval",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "CustomCashbackType",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "UsesCustomCashbackSetting",
                table: "UserWallets");
        }
    }
}
