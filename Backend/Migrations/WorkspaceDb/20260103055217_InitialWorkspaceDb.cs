using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class InitialWorkspaceDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RadiusProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ExternalId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Downrate = table.Column<int>(type: "integer", nullable: false),
                    Uprate = table.Column<int>(type: "integer", nullable: false),
                    Pool = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: false),
                    Monthly = table.Column<int>(type: "integer", nullable: false),
                    BurstEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LimitExpiration = table.Column<bool>(type: "boolean", nullable: false),
                    ExpirationAmount = table.Column<int>(type: "integer", nullable: false),
                    ExpirationUnit = table.Column<int>(type: "integer", nullable: false),
                    SiteId = table.Column<int>(type: "integer", nullable: true),
                    OnlineUsersCount = table.Column<int>(type: "integer", nullable: false),
                    UsersCount = table.Column<int>(type: "integer", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SasRadiusIntegrations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Url = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    UseHttps = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    MaxItemInPagePerRequest = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SasRadiusIntegrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SyncProgresses",
                columns: table => new
                {
                    SyncId = table.Column<Guid>(type: "uuid", nullable: false),
                    IntegrationId = table.Column<int>(type: "integer", nullable: false),
                    IntegrationName = table.Column<string>(type: "text", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentPhase = table.Column<int>(type: "integer", nullable: false),
                    ProfileCurrentPage = table.Column<int>(type: "integer", nullable: false),
                    ProfileTotalPages = table.Column<int>(type: "integer", nullable: false),
                    ProfileTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileNewRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    ProfileFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    UserCurrentPage = table.Column<int>(type: "integer", nullable: false),
                    UserTotalPages = table.Column<int>(type: "integer", nullable: false),
                    UserTotalRecords = table.Column<int>(type: "integer", nullable: false),
                    UserProcessedRecords = table.Column<int>(type: "integer", nullable: false),
                    UserNewRecords = table.Column<int>(type: "integer", nullable: false),
                    UserUpdatedRecords = table.Column<int>(type: "integer", nullable: false),
                    UserFailedRecords = table.Column<int>(type: "integer", nullable: false),
                    ProgressPercentage = table.Column<double>(type: "double precision", nullable: false),
                    CurrentMessage = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncProgresses", x => x.SyncId);
                });

            migrationBuilder.CreateTable(
                name: "RadiusUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ExternalId = table.Column<int>(type: "integer", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: true),
                    Firstname = table.Column<string>(type: "text", nullable: true),
                    Lastname = table.Column<string>(type: "text", nullable: true),
                    City = table.Column<string>(type: "text", nullable: true),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    ProfileId = table.Column<int>(type: "integer", nullable: true),
                    Balance = table.Column<decimal>(type: "numeric", nullable: false),
                    LoanBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    Expiration = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastOnline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ParentId = table.Column<int>(type: "integer", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    StaticIp = table.Column<string>(type: "text", nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Company = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    SimultaneousSessions = table.Column<int>(type: "integer", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    ContractId = table.Column<string>(type: "text", nullable: true),
                    NationalId = table.Column<string>(type: "text", nullable: true),
                    MikrotikIpv6Prefix = table.Column<string>(type: "text", nullable: true),
                    GroupId = table.Column<int>(type: "integer", nullable: true),
                    GpsLat = table.Column<string>(type: "text", nullable: true),
                    GpsLng = table.Column<string>(type: "text", nullable: true),
                    Street = table.Column<string>(type: "text", nullable: true),
                    SiteId = table.Column<int>(type: "integer", nullable: true),
                    PinTries = table.Column<int>(type: "integer", nullable: false),
                    RemainingDays = table.Column<int>(type: "integer", nullable: false),
                    OnlineStatus = table.Column<int>(type: "integer", nullable: false),
                    UsedTraffic = table.Column<long>(type: "bigint", nullable: false),
                    AvailableTraffic = table.Column<long>(type: "bigint", nullable: false),
                    ParentUsername = table.Column<string>(type: "text", nullable: true),
                    DebtDays = table.Column<int>(type: "integer", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RadiusUsers_RadiusProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "RadiusProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_ProfileId",
                table: "RadiusUsers",
                column: "ProfileId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusUsers");

            migrationBuilder.DropTable(
                name: "SasRadiusIntegrations");

            migrationBuilder.DropTable(
                name: "SyncProgresses");

            migrationBuilder.DropTable(
                name: "RadiusProfiles");
        }
    }
}
