using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class RemoveUserTableFromTenantDatabases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use raw SQL to drop constraints and table only if they exist
            // This allows the migration to work for both existing databases (with constraints)
            // and new databases (without constraints)
            
            migrationBuilder.Sql(@"
                -- Drop all foreign key constraints to User table if they exist
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (
                        SELECT constraint_name, table_name 
                        FROM information_schema.table_constraints 
                        WHERE constraint_type = 'FOREIGN KEY' 
                        AND constraint_name LIKE '%_User_%'
                        AND table_schema = 'public'
                    ) LOOP
                        EXECUTE 'ALTER TABLE ""' || r.table_name || '"" DROP CONSTRAINT IF EXISTS ""' || r.constraint_name || '""';
                    END LOOP;
                END $$;
                
                -- Drop all indexes related to User navigation properties
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (
                        SELECT indexname, tablename
                        FROM pg_indexes
                        WHERE indexname LIKE 'IX_%_User_%'
                        AND schemaname = 'public'
                    ) LOOP
                        EXECUTE 'DROP INDEX IF EXISTS ""' || r.indexname || '""';
                    END LOOP;
                END $$;
                
                -- Finally, drop the User table if it exists
                DROP TABLE IF EXISTS ""User"" CASCADE;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CurrentWorkspaceId = table.Column<int>(type: "integer", nullable: true),
                    DefaultWorkspaceId = table.Column<int>(type: "integer", nullable: true),
                    DisabledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DisabledBy = table.Column<string>(type: "text", nullable: true),
                    DisabledReason = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: false),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    KeycloakUserId = table.Column<string>(type: "text", nullable: true),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    SupervisorId = table.Column<int>(type: "integer", nullable: true),
                    Username = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Zones_CreatedBy",
                table: "Zones",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Zones_DeletedBy",
                table: "Zones",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Zones_UpdatedBy",
                table: "Zones",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowHistories_CreatedBy",
                table: "WorkflowHistories",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_WalletHistories_CreatedBy",
                table: "WalletHistories",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserZones_CreatedBy",
                table: "UserZones",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_CreatedBy",
                table: "UserWallets",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_DeletedBy",
                table: "UserWallets",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserWallets_UpdatedBy",
                table: "UserWallets",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserCashbacks_CreatedBy",
                table: "UserCashbacks",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserCashbacks_DeletedBy",
                table: "UserCashbacks",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserCashbacks_UpdatedBy",
                table: "UserCashbacks",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CreatedBy",
                table: "Transactions",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_DeletedBy",
                table: "Transactions",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UpdatedBy",
                table: "Transactions",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionComments_CreatedBy",
                table: "TransactionComments",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_CreatedBy",
                table: "RadiusNasDevices",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_DeletedBy",
                table: "RadiusIpReservations",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusGroups_DeletedBy",
                table: "RadiusGroups",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusCustomAttributes_DeletedBy",
                table: "RadiusCustomAttributes",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_DeletedBy",
                table: "RadiusActivations",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Olts_DeletedBy",
                table: "Olts",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_OltDevices_DeletedBy",
                table: "OltDevices",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Fats_DeletedBy",
                table: "Fats",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_FatPorts_DeletedBy",
                table: "FatPorts",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Dashboards_DeletedBy",
                table: "Dashboards",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardItems_DeletedBy",
                table: "DashboardItems",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardGlobalFilters_DeletedBy",
                table: "DashboardGlobalFilters",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_CreatedBy",
                table: "CustomWallets",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_DeletedBy",
                table: "CustomWallets",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_UpdatedBy",
                table: "CustomWallets",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackProfileAmounts_CreatedBy",
                table: "CashbackProfileAmounts",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackProfileAmounts_DeletedBy",
                table: "CashbackProfileAmounts",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackProfileAmounts_UpdatedBy",
                table: "CashbackProfileAmounts",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_DeletedBy",
                table: "CashbackGroups",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_CreatedBy",
                table: "BillingProfiles",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_DeletedBy",
                table: "BillingProfiles",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_UpdatedBy",
                table: "BillingProfiles",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroupUser_CreatedBy",
                table: "BillingGroupUser",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroups_CreatedBy",
                table: "BillingGroups",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroups_DeletedBy",
                table: "BillingGroups",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BillingGroups_UpdatedBy",
                table: "BillingGroups",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Automations_CreatedBy",
                table: "Automations",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Automations_DeletedBy",
                table: "Automations",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Automations_UpdatedBy",
                table: "Automations",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Addons_CreatedBy",
                table: "Addons",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Addons_DeletedBy",
                table: "Addons",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Addons_UpdatedBy",
                table: "Addons",
                column: "UpdatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Addons_User_CreatedBy",
                table: "Addons",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Addons_User_DeletedBy",
                table: "Addons",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Addons_User_UpdatedBy",
                table: "Addons",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Automations_User_CreatedBy",
                table: "Automations",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Automations_User_DeletedBy",
                table: "Automations",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Automations_User_UpdatedBy",
                table: "Automations",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingGroups_User_CreatedBy",
                table: "BillingGroups",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingGroups_User_DeletedBy",
                table: "BillingGroups",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingGroups_User_UpdatedBy",
                table: "BillingGroups",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingGroupUser_User_CreatedBy",
                table: "BillingGroupUser",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingProfiles_User_CreatedBy",
                table: "BillingProfiles",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingProfiles_User_DeletedBy",
                table: "BillingProfiles",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BillingProfiles_User_UpdatedBy",
                table: "BillingProfiles",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CashbackGroups_User_DeletedBy",
                table: "CashbackGroups",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CashbackProfileAmounts_User_CreatedBy",
                table: "CashbackProfileAmounts",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CashbackProfileAmounts_User_DeletedBy",
                table: "CashbackProfileAmounts",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CashbackProfileAmounts_User_UpdatedBy",
                table: "CashbackProfileAmounts",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CustomWallets_User_CreatedBy",
                table: "CustomWallets",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CustomWallets_User_DeletedBy",
                table: "CustomWallets",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CustomWallets_User_UpdatedBy",
                table: "CustomWallets",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DashboardGlobalFilters_User_DeletedBy",
                table: "DashboardGlobalFilters",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DashboardItems_User_DeletedBy",
                table: "DashboardItems",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Dashboards_User_DeletedBy",
                table: "Dashboards",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FatPorts_User_DeletedBy",
                table: "FatPorts",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Fats_User_DeletedBy",
                table: "Fats",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_OltDevices_User_DeletedBy",
                table: "OltDevices",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Olts_User_DeletedBy",
                table: "Olts",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusActivations_User_DeletedBy",
                table: "RadiusActivations",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusCustomAttributes_User_DeletedBy",
                table: "RadiusCustomAttributes",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusGroups_User_DeletedBy",
                table: "RadiusGroups",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusIpReservations_User_DeletedBy",
                table: "RadiusIpReservations",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusNasDevices_User_CreatedBy",
                table: "RadiusNasDevices",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TransactionComments_User_CreatedBy",
                table: "TransactionComments",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_User_CreatedBy",
                table: "Transactions",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_User_DeletedBy",
                table: "Transactions",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_User_UpdatedBy",
                table: "Transactions",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserCashbacks_User_CreatedBy",
                table: "UserCashbacks",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserCashbacks_User_DeletedBy",
                table: "UserCashbacks",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserCashbacks_User_UpdatedBy",
                table: "UserCashbacks",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserWallets_User_CreatedBy",
                table: "UserWallets",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserWallets_User_DeletedBy",
                table: "UserWallets",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserWallets_User_UpdatedBy",
                table: "UserWallets",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserZones_User_CreatedBy",
                table: "UserZones",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_WalletHistories_User_CreatedBy",
                table: "WalletHistories",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkflowHistories_User_CreatedBy",
                table: "WorkflowHistories",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Zones_User_CreatedBy",
                table: "Zones",
                column: "CreatedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Zones_User_DeletedBy",
                table: "Zones",
                column: "DeletedBy",
                principalTable: "User",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Zones_User_UpdatedBy",
                table: "Zones",
                column: "UpdatedBy",
                principalTable: "User",
                principalColumn: "Id");
        }
    }
}
