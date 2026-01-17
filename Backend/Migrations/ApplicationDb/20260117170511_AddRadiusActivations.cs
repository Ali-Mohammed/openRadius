using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class AddRadiusActivations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProfileBillingId",
                table: "RadiusUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RadiusActivations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ActionById = table.Column<int>(type: "integer", nullable: true),
                    ActionByUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ActionForId = table.Column<int>(type: "integer", nullable: true),
                    ActionForUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IsActionBehalf = table.Column<bool>(type: "boolean", nullable: false),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    RadiusUsername = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PreviousRadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    PreviousBillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: true),
                    PreviousExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CurrentExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextExpireDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PreviousBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    NewBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ApiStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ApiStatusCode = table.Column<int>(type: "integer", nullable: true),
                    ApiStatusMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ApiResponse = table.Column<string>(type: "text", nullable: true),
                    ExternalReferenceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransactionId = table.Column<int>(type: "integer", nullable: true),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DurationDays = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    LastRetryAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessingCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusActivations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_BillingProfiles_PreviousBillingProfileId",
                        column: x => x.PreviousBillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_RadiusProfiles_PreviousRadiusProfileId",
                        column: x => x.PreviousRadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RadiusActivations_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_ApiStatus",
                table: "RadiusActivations",
                column: "ApiStatus");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_BillingProfileId",
                table: "RadiusActivations",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_CreatedAt",
                table: "RadiusActivations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_PreviousBillingProfileId",
                table: "RadiusActivations",
                column: "PreviousBillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_PreviousRadiusProfileId",
                table: "RadiusActivations",
                column: "PreviousRadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_RadiusProfileId",
                table: "RadiusActivations",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_RadiusUserId",
                table: "RadiusActivations",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_RadiusUserId_CreatedAt",
                table: "RadiusActivations",
                columns: new[] { "RadiusUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_Status",
                table: "RadiusActivations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusActivations_Type",
                table: "RadiusActivations",
                column: "Type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusActivations");

            migrationBuilder.DropColumn(
                name: "ProfileBillingId",
                table: "RadiusUsers");
        }
    }
}
