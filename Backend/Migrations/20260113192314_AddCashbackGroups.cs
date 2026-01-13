using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddCashbackGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CashbackGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Disabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashbackGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CashbackGroupUsers",
                columns: table => new
                {
                    CashbackGroupId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashbackGroupUsers", x => new { x.CashbackGroupId, x.UserId });
                    table.ForeignKey(
                        name: "FK_CashbackGroupUsers_CashbackGroups_CashbackGroupId",
                        column: x => x.CashbackGroupId,
                        principalTable: "CashbackGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CashbackGroupUsers_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_DeletedAt",
                table: "CashbackGroups",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_Disabled",
                table: "CashbackGroups",
                column: "Disabled");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroups_Name",
                table: "CashbackGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_CashbackGroupUsers_UserId",
                table: "CashbackGroupUsers",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CashbackGroupUsers");

            migrationBuilder.DropTable(
                name: "CashbackGroups");
        }
    }
}
