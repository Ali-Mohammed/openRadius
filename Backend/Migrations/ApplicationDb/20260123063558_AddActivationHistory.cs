using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddActivationHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivationHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RadiusActivationId = table.Column<int>(type: "integer", nullable: false),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    BillingProfileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    RadiusUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ActionById = table.Column<int>(type: "integer", nullable: true),
                    ActionByUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ActionForId = table.Column<int>(type: "integer", nullable: true),
                    ActionForUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IsActionBehalf = table.Column<bool>(type: "boolean", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    CashbackAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    ActivationType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ActivationStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PreviousExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NewExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DurationDays = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    TransactionId = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    WalletDistribution = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessingStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivationHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActivationHistories_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ActivationHistories_RadiusActivations_RadiusActivationId",
                        column: x => x.RadiusActivationId,
                        principalTable: "RadiusActivations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivationHistories_BillingProfileId",
                table: "ActivationHistories",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivationHistories_RadiusActivationId",
                table: "ActivationHistories",
                column: "RadiusActivationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivationHistories");
        }
    }
}
