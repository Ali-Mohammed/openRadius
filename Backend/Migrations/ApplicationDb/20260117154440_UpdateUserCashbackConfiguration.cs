using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class UpdateUserCashbackConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop FK only if it exists (may have been removed in a previous migration or never created)
            migrationBuilder.Sql(@"
                DO $$ 
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_UserCashbacks_User_UserId' AND table_name = 'UserCashbacks') THEN
                        ALTER TABLE ""UserCashbacks"" DROP CONSTRAINT ""FK_UserCashbacks_User_UserId"";
                    END IF;
                END $$;
            ");

            // Drop index only if it exists
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ""IX_UserCashbacks_UserId"";
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_UserCashbacks_UserId",
                table: "UserCashbacks",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserCashbacks_User_UserId",
                table: "UserCashbacks",
                column: "UserId",
                principalTable: "User",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
