using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class FixActivationRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_BillingProfiles_BillingProfileId",
                table: "BillingActivations");

            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_RadiusActivations_RadiusActivationId",
                table: "BillingActivations");

            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_Transactions_TransactionId",
                table: "BillingActivations");

            migrationBuilder.DropForeignKey(
                name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                table: "RadiusActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_RadiusActivationId",
                table: "BillingActivations");

            migrationBuilder.DropColumn(
                name: "RadiusActivationId",
                table: "BillingActivations");

            migrationBuilder.AlterColumn<int>(
                name: "BillingActivationId",
                table: "RadiusActivations",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

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

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_ActionById",
                table: "BillingActivations",
                column: "ActionById");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_ActivationStatus",
                table: "BillingActivations",
                column: "ActivationStatus");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_ActivationType",
                table: "BillingActivations",
                column: "ActivationType");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_CreatedAt",
                table: "BillingActivations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_RadiusUserId",
                table: "BillingActivations",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_RadiusUserId_CreatedAt",
                table: "BillingActivations",
                columns: new[] { "RadiusUserId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_BillingProfiles_BillingProfileId",
                table: "BillingActivations",
                column: "BillingProfileId",
                principalTable: "BillingProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_Transactions_TransactionId",
                table: "BillingActivations",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                table: "RadiusActivations",
                column: "BillingActivationId",
                principalTable: "BillingActivations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_BillingProfiles_BillingProfileId",
                table: "BillingActivations");

            migrationBuilder.DropForeignKey(
                name: "FK_BillingActivations_Transactions_TransactionId",
                table: "BillingActivations");

            migrationBuilder.DropForeignKey(
                name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                table: "RadiusActivations");

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

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_ActionById",
                table: "BillingActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_ActivationStatus",
                table: "BillingActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_ActivationType",
                table: "BillingActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_CreatedAt",
                table: "BillingActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_RadiusUserId",
                table: "BillingActivations");

            migrationBuilder.DropIndex(
                name: "IX_BillingActivations_RadiusUserId_CreatedAt",
                table: "BillingActivations");

            migrationBuilder.AlterColumn<int>(
                name: "BillingActivationId",
                table: "RadiusActivations",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "RadiusActivationId",
                table: "BillingActivations",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingActivations_RadiusActivationId",
                table: "BillingActivations",
                column: "RadiusActivationId");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_BillingProfiles_BillingProfileId",
                table: "BillingActivations",
                column: "BillingProfileId",
                principalTable: "BillingProfiles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_RadiusActivations_RadiusActivationId",
                table: "BillingActivations",
                column: "RadiusActivationId",
                principalTable: "RadiusActivations",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingActivations_Transactions_TransactionId",
                table: "BillingActivations",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusActivations_BillingActivations_BillingActivationId",
                table: "RadiusActivations",
                column: "BillingActivationId",
                principalTable: "BillingActivations",
                principalColumn: "Id");
        }
    }
}
