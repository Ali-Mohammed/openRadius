using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentForceCompletions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentForceCompletions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentLogId = table.Column<int>(type: "integer", nullable: false),
                    PreviousStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Justification = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    DocumentPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DocumentFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DocumentContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DocumentFileSize = table.Column<long>(type: "bigint", nullable: false),
                    AmountCredited = table.Column<decimal>(type: "numeric", nullable: false),
                    Gateway = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentForceCompletions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaymentForceCompletions_PaymentLogs_PaymentLogId",
                        column: x => x.PaymentLogId,
                        principalTable: "PaymentLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentForceCompletions_PaymentLogId",
                table: "PaymentForceCompletions",
                column: "PaymentLogId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentForceCompletions");
        }
    }
}
