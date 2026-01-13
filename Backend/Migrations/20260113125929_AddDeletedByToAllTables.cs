using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddDeletedByToAllTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "RadiusGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Olts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "Olts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "OltDevices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "OltDevices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Fats",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "Fats",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "FatPorts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "FatPorts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Dashboards",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "Dashboards",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "DashboardItems",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "DashboardItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "DashboardGlobalFilters",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                table: "DashboardGlobalFilters",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "RadiusGroups");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Olts");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Olts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "OltDevices");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "OltDevices");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Fats");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Fats");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "FatPorts");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "FatPorts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Dashboards");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Dashboards");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "DashboardItems");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "DashboardItems");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "DashboardGlobalFilters");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "DashboardGlobalFilters");
        }
    }
}
