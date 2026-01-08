using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddBillingProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BillingProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: false),
                    BillingGroupId = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfiles_BillingGroups_BillingGroupId",
                        column: x => x.BillingGroupId,
                        principalTable: "BillingGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BillingProfiles_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BillingProfileAddons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfileAddons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfileAddons_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BillingProfileWallets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BillingProfileId = table.Column<int>(type: "integer", nullable: false),
                    WalletType = table.Column<string>(type: "text", nullable: false),
                    CustomWalletId = table.Column<int>(type: "integer", nullable: true),
                    Percentage = table.Column<decimal>(type: "numeric", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingProfileWallets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillingProfileWallets_BillingProfiles_BillingProfileId",
                        column: x => x.BillingProfileId,
                        principalTable: "BillingProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileAddons_BillingProfileId",
                table: "BillingProfileAddons",
                column: "BillingProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_BillingGroupId",
                table: "BillingProfiles",
                column: "BillingGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_Name",
                table: "BillingProfiles",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfiles_RadiusProfileId",
                table: "BillingProfiles",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingProfileWallets_BillingProfileId",
                table: "BillingProfileWallets",
                column: "BillingProfileId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillingProfileAddons");

            migrationBuilder.DropTable(
                name: "BillingProfileWallets");

            migrationBuilder.DropTable(
                name: "BillingProfiles");
        }
    }
}
