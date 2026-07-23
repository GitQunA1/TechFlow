using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinimalAPIs.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmittedNoteToRevisionRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SubmittedNote",
                table: "StaffRevisionRequests",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SubmittedNote",
                table: "StaffRevisionRequests");
        }
    }
}
