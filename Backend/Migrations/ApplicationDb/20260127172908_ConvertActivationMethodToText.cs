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
            // Convert text back to integer
            migrationBuilder.Sql(@"
                ALTER TABLE ""SasRadiusIntegrations"" 
                ALTER COLUMN ""ActivationMethod"" DROP DEFAULT;
            ");
            
            migrationBuilder.Sql(@"
                ALTER TABLE ""SasRadiusIntegrations"" 
                ALTER COLUMN ""ActivationMethod"" TYPE integer 
                USING (CASE ""ActivationMethod""
                    WHEN 'ManagerBalance' THEN 0
                    WHEN 'PrepaidCard' THEN 1
                    WHEN 'UserBalance' THEN 2
                    WHEN 'RewardPoints' THEN 3
                    ELSE 0
                END);
            ");
            
            migrationBuilder.Sql(@"
                ALTER TABLE ""SasRadiusIntegrations"" 
                ALTER COLUMN ""ActivationMethod"" SET DEFAULT 0;
            ");
        }
    }
}
