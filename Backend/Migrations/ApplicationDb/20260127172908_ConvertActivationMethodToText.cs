using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations.ApplicationDb
{
    /// <inheritdoc />
    public partial class ConvertActivationMethodToText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use raw SQL to properly convert integer to text with value mapping
            migrationBuilder.Sql(@"
                ALTER TABLE ""SasRadiusIntegrations"" 
                ALTER COLUMN ""ActivationMethod"" TYPE text 
                USING (CASE ""ActivationMethod""
                    WHEN 0 THEN 'ManagerBalance'
                    WHEN 1 THEN 'PrepaidCard'
                    WHEN 2 THEN 'UserBalance'
                    WHEN 3 THEN 'RewardPoints'
                    ELSE 'ManagerBalance'
                END);
            ");
            
            // Set default value
            migrationBuilder.Sql(@"
                ALTER TABLE ""SasRadiusIntegrations"" 
                ALTER COLUMN ""ActivationMethod"" SET DEFAULT 'ManagerBalance';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "ActivationMethod",
                table: "SasRadiusIntegrations",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
