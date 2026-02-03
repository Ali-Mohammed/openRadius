using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class InitialApplicationWithUuid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "Zones",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "WorkflowHistories",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "WebhookLogs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "WalletHistories",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "UserZones",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "UserWallets",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "UserCashbacks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "Transactions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "TransactionHistories",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "TransactionComments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "TablePreferences",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "SubAgentCashbacks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "SasRadiusIntegrations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "SasActivationLogs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusUsers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusTags",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusProfileWallets",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusProfiles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusNasDevices",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusIpReservations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusGroups",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusCustomAttributes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "RadiusActivations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "radius_ip_pools",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "PaymentMethods",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "PaymentLogs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "OltDevices",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "MicroserviceApprovals",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "IntegrationWebhooks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "DebeziumSettings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "DebeziumConnectors",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "DashboardTabs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "Dashboards",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "DashboardItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "DashboardGlobalFilters",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "CustomWallets",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "CashbackProfileAmounts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "CashbackGroups",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "BillingProfileWallets",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "BillingProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExpirationDays",
                table: "BillingProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "BillingProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOffer",
                table: "BillingProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "OfferEndDate",
                table: "BillingProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OfferStartDate",
                table: "BillingProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform",
                table: "BillingProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "BillingProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresApproval",
                table: "BillingProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "TotalQuantity",
                table: "BillingProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsedQuantity",
                table: "BillingProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "UserType",
                table: "BillingProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "BillingProfiles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "BillingProfileAddons",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "BillingGroups",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "BillingActivations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "Automations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Uuid",
                table: "Addons",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "BillingProfileUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AssignedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfileUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfileUsers_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileUsers_BillingProfileId_UserId",
                table: "BillingProfileUsers",
                columns: new[] { "BillingProfileId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillingProfileUsers");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "Zones");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "WorkflowHistories");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "WebhookLogs");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "WalletHistories");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "UserZones");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "UserCashbacks");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "TransactionHistories");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "TransactionComments");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "TablePreferences");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "SubAgentCashbacks");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "SasRadiusIntegrations");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "SasActivationLogs");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusUsers");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusTags");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusProfileWallets");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusProfiles");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusNasDevices");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusIpReservations");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusGroups");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusCustomAttributes");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "RadiusActivations");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "radius_ip_pools");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "PaymentMethods");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "PaymentLogs");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "OltDevices");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "MicroserviceApprovals");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "IntegrationWebhooks");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "DebeziumSettings");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "DebeziumConnectors");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "DashboardTabs");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "Dashboards");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "DashboardItems");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "DashboardGlobalFilters");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "CustomWallets");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "CashbackProfileAmounts");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "CashbackGroups");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "BillingProfileWallets");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "ExpirationDays",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "IsOffer",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "OfferEndDate",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "OfferStartDate",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "Platform",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "RequiresApproval",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "TotalQuantity",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "UsedQuantity",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "UserType",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "BillingProfiles");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "BillingProfileAddons");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "BillingGroups");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "BillingActivations");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "Automations");

            migrationBuilder.DropColumn(
                name: "Uuid",
                table: "Addons");
        }
    }
}
