using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomationExecutionStepsAndHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AutomationExecutionLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    AutomationId = table.Column<int>(type: "integer", nullable: false),
                    AutomationTitle = table.Column<string>(type: "text", nullable: true),
                    TriggerType = table.Column<string>(type: "text", nullable: false),
                    TriggerNodeId = table.Column<string>(type: "text", nullable: true),
                    RadiusUserId = table.Column<int>(type: "integer", nullable: true),
                    RadiusUserUuid = table.Column<Guid>(type: "uuid", nullable: true),
                    RadiusUsername = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ResultSummary = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    ErrorStackTrace = table.Column<string>(type: "text", nullable: true),
                    EventData = table.Column<string>(type: "text", nullable: true),
                    WorkflowSnapshot = table.Column<string>(type: "text", nullable: true),
                    TotalNodes = table.Column<int>(type: "integer", nullable: false),
                    TotalEdges = table.Column<int>(type: "integer", nullable: false),
                    NodesVisited = table.Column<int>(type: "integer", nullable: false),
                    ActionsExecuted = table.Column<int>(type: "integer", nullable: false),
                    ActionsSucceeded = table.Column<int>(type: "integer", nullable: false),
                    ActionsFailed = table.Column<int>(type: "integer", nullable: false),
                    ConditionsEvaluated = table.Column<int>(type: "integer", nullable: false),
                    ExecutionTimeMs = table.Column<long>(type: "bigint", nullable: false),
                    TriggeredBy = table.Column<string>(type: "text", nullable: true),
                    SourceIpAddress = table.Column<string>(type: "text", nullable: true),
                    CorrelationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Environment = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationExecutionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationExecutionLogs_Automations_AutomationId",
                        column: x => x.AutomationId,
                        principalTable: "Automations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AutomationExecutionSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    ExecutionLogId = table.Column<int>(type: "integer", nullable: false),
                    StepOrder = table.Column<int>(type: "integer", nullable: false),
                    NodeId = table.Column<string>(type: "text", nullable: false),
                    NodeType = table.Column<string>(type: "text", nullable: false),
                    NodeSubType = table.Column<string>(type: "text", nullable: true),
                    NodeLabel = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Result = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    InputData = table.Column<string>(type: "text", nullable: true),
                    OutputData = table.Column<string>(type: "text", nullable: true),
                    ExecutionTimeMs = table.Column<long>(type: "bigint", nullable: false),
                    HttpMethod = table.Column<string>(type: "text", nullable: true),
                    HttpUrl = table.Column<string>(type: "text", nullable: true),
                    HttpRequestHeaders = table.Column<string>(type: "text", nullable: true),
                    HttpRequestBody = table.Column<string>(type: "text", nullable: true),
                    HttpResponseStatusCode = table.Column<int>(type: "integer", nullable: true),
                    HttpResponseHeaders = table.Column<string>(type: "text", nullable: true),
                    HttpResponseBody = table.Column<string>(type: "text", nullable: true),
                    HttpResponseTimeMs = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationExecutionSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationExecutionSteps_AutomationExecutionLogs_ExecutionL~",
                        column: x => x.ExecutionLogId,
                        principalTable: "AutomationExecutionLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_AutomationId",
                table: "AutomationExecutionLogs",
                column: "AutomationId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_AutomationId_TriggerType_CreatedAt",
                table: "AutomationExecutionLogs",
                columns: new[] { "AutomationId", "TriggerType", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_CreatedAt",
                table: "AutomationExecutionLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_RadiusUserId",
                table: "AutomationExecutionLogs",
                column: "RadiusUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_RadiusUserId_CreatedAt",
                table: "AutomationExecutionLogs",
                columns: new[] { "RadiusUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_Status",
                table: "AutomationExecutionLogs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_TriggerType",
                table: "AutomationExecutionLogs",
                column: "TriggerType");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionLogs_Uuid",
                table: "AutomationExecutionLogs",
                column: "Uuid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionSteps_CreatedAt",
                table: "AutomationExecutionSteps",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionSteps_ExecutionLogId",
                table: "AutomationExecutionSteps",
                column: "ExecutionLogId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionSteps_ExecutionLogId_StepOrder",
                table: "AutomationExecutionSteps",
                columns: new[] { "ExecutionLogId", "StepOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionSteps_NodeType",
                table: "AutomationExecutionSteps",
                column: "NodeType");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionSteps_Status",
                table: "AutomationExecutionSteps",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationExecutionSteps_Uuid",
                table: "AutomationExecutionSteps",
                column: "Uuid",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AutomationExecutionSteps");

            migrationBuilder.DropTable(
                name: "AutomationExecutionLogs");
        }
    }
}
