using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomationTriggerAndScheduleFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CronExpression",
                table: "Automations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleIntervalMinutes",
                table: "Automations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScheduleType",
                table: "Automations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledTime",
                table: "Automations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TriggerType",
                table: "Automations",
                type: "text",
                nullable: false,
                defaultValue: "on_requested");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CronExpression",
                table: "Automations");

            migrationBuilder.DropColumn(
                name: "ScheduleIntervalMinutes",
                table: "Automations");

            migrationBuilder.DropColumn(
                name: "ScheduleType",
                table: "Automations");

            migrationBuilder.DropColumn(
                name: "ScheduledTime",
                table: "Automations");

            migrationBuilder.DropColumn(
                name: "TriggerType",
                table: "Automations");
        }
    }
}
