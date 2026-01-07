using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddCustomWalletsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomWallets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    MaxFillLimit = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DailySpendingLimit = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Icon = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CurrentBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomWallets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_Name",
                table: "CustomWallets",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_Status",
                table: "CustomWallets",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CustomWallets_Type",
                table: "CustomWallets",
                column: "Type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomWallets");
        }
    }
}
