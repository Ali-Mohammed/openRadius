using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalIdAndDescriptionToRadiusGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GroupCurrentPage",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GroupFailedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GroupNewRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GroupProcessedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GroupTotalPages",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GroupTotalRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GroupUpdatedRecords",
                table: "SyncProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "RadiusGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExternalId",
                table: "RadiusGroups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSyncedAt",
                table: "RadiusGroups",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GroupCurrentPage",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "GroupFailedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "GroupNewRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "GroupProcessedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "GroupTotalPages",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "GroupTotalRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "GroupUpdatedRecords",
                table: "SyncProgresses");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "RadiusGroups");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "RadiusGroups");

            migrationBuilder.DropColumn(
                name: "LastSyncedAt",
                table: "RadiusGroups");
        }
    }
}
