using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddWalletHistoryAndTopUp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WalletHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WalletType = table.Column<string>(type: "text", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    UserWalletId = table.Column<int>(type: "integer", nullable: true),
                    TransactionType = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceBefore = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "numeric", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    Reference = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WalletHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WalletHistories_CustomWallets_CustomWalletId",
                        column: x => x.CustomWalletId,
                        principalTable: "CustomWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WalletHistories_UserWallets_UserWalletId",
                        column: x => x.UserWalletId,
                        principalTable: "UserWallets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_CreatedAt",
                table: "WalletHistories",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_CustomWalletId",
                table: "WalletHistories",
                column: "CustomWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_TransactionType",
                table: "WalletHistories",
                column: "TransactionType");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_UserId",
                table: "WalletHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_UserWalletId",
                table: "WalletHistories",
                column: "UserWalletId");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_WalletType",
                table: "WalletHistories",
                column: "WalletType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WalletHistories");
        }
    }
}
