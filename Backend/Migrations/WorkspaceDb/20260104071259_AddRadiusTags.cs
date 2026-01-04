using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddRadiusTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RadiusTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusTags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusUserTags",
                columns: table => new
                {
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    RadiusTagId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusUserTags", x => new { x.RadiusUserId, x.RadiusTagId });
                    table.ForeignKey(
                        name: "FK_RadiusUserTags_RadiusTags_RadiusTagId",
                        column: x => x.RadiusTagId,
                        principalTable: "RadiusTags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RadiusUserTags_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusTags_Title",
                table: "RadiusTags",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUserTags_RadiusTagId",
                table: "RadiusUserTags",
                column: "RadiusTagId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusUserTags");

            migrationBuilder.DropTable(
                name: "RadiusTags");
        }
    }
}
