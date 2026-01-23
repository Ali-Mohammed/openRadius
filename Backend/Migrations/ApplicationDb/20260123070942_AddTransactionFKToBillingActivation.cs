using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddTransactionFKToBillingActivation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_TransactionId",
                table: "BillingActivations",
                column: "TransactionId");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_Transactions_TransactionId",
                table: "BillingActivations",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_Transactions_TransactionId",
                table: "BillingActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_TransactionId",
                table: "BillingActivations");
        }
    }
}
