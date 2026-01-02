using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.MasterDb
{
    /// <inheritdoc />
    public partial class AddRadiusUserProfileRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "MaxPagesPerRequest",
                table: "SasRadiusIntegrations",
                newName: "MaxItemInPagePerRequest");

            // Clean up invalid ProfileId values before adding foreign key constraint
            migrationBuilder.Sql(
                @"UPDATE ""RadiusUsers"" 
                  SET ""ProfileId"" = NULL 
                  WHERE ""ProfileId"" IS NOT NULL 
                  AND ""ProfileId"" NOT IN (SELECT ""Id"" FROM ""RadiusProfiles"");");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_ProfileId",
                table: "RadiusUsers",
                column: "ProfileId");

            migrationBuilder.AddForeignKey(
                name: "FK_RadiusUsers_RadiusProfiles_ProfileId",
                table: "RadiusUsers",
                column: "ProfileId",
                principalTable: "RadiusProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RadiusUsers_RadiusProfiles_ProfileId",
                table: "RadiusUsers");

            migrationBuilder.DropIndex(
                name: "IX_RadiusUsers_ProfileId",
                table: "RadiusUsers");

            migrationBuilder.RenameColumn(
                name: "MaxItemInPagePerRequest",
                table: "SasRadiusIntegrations",
                newName: "MaxPagesPerRequest");
        }
    }
}
