using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "radius_ip_pools",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    start_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    end_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    lease_time = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    workspace_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_radius_ip_pools", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Subscription = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusNasDevices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nasname = table.Column<string>(type: "text", nullable: false),
                    Shortname = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Secret = table.Column<string>(type: "text", nullable: false),
                    ApiUsername = table.Column<string>(type: "text", nullable: true),
                    ApiPassword = table.Column<string>(type: "text", nullable: true),
                    CoaPort = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Server = table.Column<string>(type: "text", nullable: true),
                    Enabled = table.Column<int>(type: "integer", nullable: false),
                    SiteId = table.Column<int>(type: "integer", nullable: true),
                    HttpPort = table.Column<int>(type: "integer", nullable: false),
                    Monitor = table.Column<int>(type: "integer", nullable: false),
                    PingTime = table.Column<int>(type: "integer", nullable: false),
                    PingLoss = table.Column<int>(type: "integer", nullable: false),
                    IpAccountingEnabled = table.Column<int>(type: "integer", nullable: false),
                    PoolName = table.Column<string>(type: "text", nullable: true),
                    ApiPort = table.Column<int>(type: "integer", nullable: true),
                    SnmpCommunity = table.Column<string>(type: "text", nullable: true),
                    SshUsername = table.Column<string>(type: "text", nullable: true),
                    SshPassword = table.Column<string>(type: "text", nullable: true),
                    SshPort = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusNasDevices", x => x.Id);
                });

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
                    Color = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "text", nullable: false),
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusProfiles", x => x.Id);
                });

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
                    Icon = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusTags", x => x.Id);
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
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                name: "IX_radius_ip_pools_name",
                table: "radius_ip_pools",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_Nasname",
                table: "RadiusNasDevices",
                column: "Nasname");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusNasDevices_Shortname",
                table: "RadiusNasDevices",
                column: "Shortname");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusTags_Title",
                table: "RadiusTags",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUsers_ProfileId",
                table: "RadiusUsers",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusUserTags_RadiusTagId",
                table: "RadiusUserTags",
                column: "RadiusTagId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "radius_ip_pools");

            migrationBuilder.DropTable(
                name: "RadiusGroups");

            migrationBuilder.DropTable(
                name: "RadiusNasDevices");

            migrationBuilder.DropTable(
                name: "RadiusUserTags");

            migrationBuilder.DropTable(
                name: "SasRadiusIntegrations");

            migrationBuilder.DropTable(
                name: "SyncProgresses");

            migrationBuilder.DropTable(
                name: "RadiusTags");

            migrationBuilder.DropTable(
                name: "RadiusUsers");

            migrationBuilder.DropTable(
                name: "RadiusProfiles");
        }
    }
}
