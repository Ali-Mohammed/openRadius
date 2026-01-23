using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddTransactionCashbackIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CashbackStatus",
                table: "Transactions",
                column: "CashbackStatus");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DeletedAt",
                table: "Transactions",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_WalletType_TransactionType_CashbackStatus_Dele~",
                table: "Transactions",
                columns: new[] { "WalletType", "TransactionType", "CashbackStatus", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_DeletedAt",
                table: "SubAgentCashbacks",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_SubAgentId",
                table: "SubAgentCashbacks",
                column: "SubAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_SupervisorId",
                table: "SubAgentCashbacks",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_SubAgentCashbacks_SupervisorId_SubAgentId_BillingProfileId",
                table: "SubAgentCashbacks",
                columns: new[] { "SupervisorId", "SubAgentId", "BillingProfileId" },
                unique: true,
                filter: "\"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_CashbackStatus",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_DeletedAt",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_WalletType_TransactionType_CashbackStatus_Dele~",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_SubAgentCashbacks_DeletedAt",
                table: "SubAgentCashbacks");

            migrationBuilder.DropIndex(
                name: "IX_SubAgentCashbacks_SubAgentId",
                table: "SubAgentCashbacks");

            migrationBuilder.DropIndex(
                name: "IX_SubAgentCashbacks_SupervisorId",
                table: "SubAgentCashbacks");

            migrationBuilder.DropIndex(
                name: "IX_SubAgentCashbacks_SupervisorId_SubAgentId_BillingProfileId",
                table: "SubAgentCashbacks");
        }
    }
}
