using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MinimalAPIs.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffDraftAndRevision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DraftFiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FolderId = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    UploadedById = table.Column<int>(type: "integer", nullable: false),
                    DepartmentIds = table.Column<int[]>(type: "integer[]", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    RejectReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedById = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DraftFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DraftFiles_Folders_FolderId",
                        column: x => x.FolderId,
                        principalTable: "Folders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DraftFiles_Users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DraftFiles_Users_UploadedById",
                        column: x => x.UploadedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StaffRevisionRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FileId = table.Column<int>(type: "integer", nullable: false),
                    RequestedById = table.Column<int>(type: "integer", nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    AssignedStaffId = table.Column<int>(type: "integer", nullable: true),
                    SubmittedFileUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SubmittedFileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffRevisionRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffRevisionRequests_Files_FileId",
                        column: x => x.FileId,
                        principalTable: "Files",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffRevisionRequests_Users_AssignedStaffId",
                        column: x => x.AssignedStaffId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StaffRevisionRequests_Users_RequestedById",
                        column: x => x.RequestedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DraftFiles_FolderId",
                table: "DraftFiles",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_DraftFiles_ReviewedById",
                table: "DraftFiles",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_DraftFiles_UploadedById",
                table: "DraftFiles",
                column: "UploadedById");

            migrationBuilder.CreateIndex(
                name: "IX_StaffRevisionRequests_AssignedStaffId",
                table: "StaffRevisionRequests",
                column: "AssignedStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffRevisionRequests_FileId",
                table: "StaffRevisionRequests",
                column: "FileId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffRevisionRequests_RequestedById",
                table: "StaffRevisionRequests",
                column: "RequestedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DraftFiles");

            migrationBuilder.DropTable(
                name: "StaffRevisionRequests");
        }
    }
}
