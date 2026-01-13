using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRadiusIpReservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RadiusIpReservations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IpAddress = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusIpReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusIpReservations_RadiusUsers_RadiusUserId",
                        column: x => x.RadiusUserId,
                        principalTable: "RadiusUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_GroupId",
                table: "RadiusUsers",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_RadiusUserId",
                table: "RadiusIpReservations",
                column: "RadiusUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusUsers_RadiusGroups_GroupId",
                table: "RadiusUsers",
                column: "GroupId",
                principalTable: "RadiusGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RadiusUsers_RadiusGroups_GroupId",
                table: "RadiusUsers");

            migrationBuilder.DropTable(
                name: "RadiusIpReservations");

            migrationBuilder.DropIndex(
                name: "IX_RadiusUsers_GroupId",
                table: "RadiusUsers");
        }
    }
}
