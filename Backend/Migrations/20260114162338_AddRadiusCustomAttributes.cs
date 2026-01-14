using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRadiusCustomAttributes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RadiusCustomAttributes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AttributeName = table.Column<string>(type: "text", nullable: false),
                    AttributeValue = table.Column<string>(type: "text", nullable: false),
                    AttributeType = table.Column<int>(type: "integer", nullable: false),
                    Operator = table.Column<string>(type: "text", nullable: false),
                    LinkType = table.Column<string>(type: "text", nullable: false),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: true),
                    RadiusProfileId = table.Column<int>(type: "integer", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusCustomAttributes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusCustomAttributes_RadiusProfiles_RadiusProfileId",
                        column: x => x.RadiusProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RadiusCustomAttributes_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusCustomAttributes_RadiusProfileId",
                table: "RadiusCustomAttributes",
                column: "RadiusProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusCustomAttributes_RadiusUserId",
                table: "RadiusCustomAttributes",
                column: "RadiusUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusCustomAttributes");
        }
    }
}
