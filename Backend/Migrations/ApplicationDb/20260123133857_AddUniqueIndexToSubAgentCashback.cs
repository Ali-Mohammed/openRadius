using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddUniqueIndexToSubAgentCashback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                name: "IX_SubAgentCashbacks_SupervisorId_SubAgentId_BillingProfileId",
                table: "SubAgentCashbacks");
        }
    }
}
