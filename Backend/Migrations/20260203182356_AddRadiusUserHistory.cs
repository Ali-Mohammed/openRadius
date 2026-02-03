using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRadiusUserHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RadiusUserHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Changes = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    OldValue = table.Column<string>(type: "text", nullable: true),
                    NewValue = table.Column<string>(type: "text", nullable: true),
                    PerformedBy = table.Column<string>(type: "text", nullable: true),
                    PerformedById = table.Column<int>(type: "integer", nullable: true),
                    PerformedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    UserAgent = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusUserHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusUserHistories_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUserHistories_RadiusUserId",
                table: "RadiusUserHistories",
                column: "RadiusUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusUserHistories");
        }
    }
}
