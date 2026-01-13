using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRadiusIpReservationIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RadiusIpReservations_RadiusUsers_RadiusUserId",
                table: "RadiusIpReservations");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_DeletedAt",
                table: "RadiusIpReservations",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_IpAddress",
                table: "RadiusIpReservations",
                column: "IpAddress");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_IpAddress_DeletedAt",
                table: "RadiusIpReservations",
                columns: new[] { "IpAddress", "DeletedAt" },
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusIpReservations_RadiusUserId_DeletedAt",
                table: "RadiusIpReservations",
                columns: new[] { "RadiusUserId", "DeletedAt" },
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusIpReservations_RadiusUsers_RadiusUserId",
                table: "RadiusIpReservations",
                column: "RadiusUserId",
                principalTable: "RadiusUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RadiusIpReservations_RadiusUsers_RadiusUserId",
                table: "RadiusIpReservations");

            migrationBuilder.DropIndex(
                name: "IX_RadiusIpReservations_DeletedAt",
                table: "RadiusIpReservations");

            migrationBuilder.DropIndex(
                name: "IX_RadiusIpReservations_IpAddress",
                table: "RadiusIpReservations");

            migrationBuilder.DropIndex(
                name: "IX_RadiusIpReservations_IpAddress_DeletedAt",
                table: "RadiusIpReservations");

            migrationBuilder.DropIndex(
                name: "IX_RadiusIpReservations_RadiusUserId_DeletedAt",
                table: "RadiusIpReservations");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusIpReservations_RadiusUsers_RadiusUserId",
                table: "RadiusIpReservations",
                column: "RadiusUserId",
                principalTable: "RadiusUsers",
                principalColumn: "Id");
        }
    }
}
