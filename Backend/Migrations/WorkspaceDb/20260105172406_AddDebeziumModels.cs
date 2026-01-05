using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations.WorkspaceDb
{
    /// <inheritdoc />
    public partial class AddDebeziumModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DebeziumConnectors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ConnectorClass = table.Column<string>(type: "text", nullable: false),
                    DatabaseHostname = table.Column<string>(type: "text", nullable: false),
                    DatabasePort = table.Column<int>(type: "integer", nullable: false),
                    DatabaseUser = table.Column<string>(type: "text", nullable: false),
                    DatabasePassword = table.Column<string>(type: "text", nullable: false),
                    DatabaseName = table.Column<string>(type: "text", nullable: false),
                    DatabaseServerName = table.Column<string>(type: "text", nullable: false),
                    PluginName = table.Column<string>(type: "text", nullable: false),
                    SlotName = table.Column<string>(type: "text", nullable: false),
                    PublicationAutocreateMode = table.Column<string>(type: "text", nullable: false),
                    TableIncludeList = table.Column<string>(type: "text", nullable: false),
                    SnapshotMode = table.Column<string>(type: "text", nullable: false),
                    AdditionalConfig = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DebeziumConnectors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DebeziumSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConnectUrl = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: true),
                    Password = table.Column<string>(type: "text", nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DebeziumSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DebeziumConnectors");

            migrationBuilder.DropTable(
                name: "DebeziumSettings");
        }
    }
}
