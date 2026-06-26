using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinimalAPIs.Migrations
{
    /// <inheritdoc />
    public partial class AddTargetFileIdToNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TargetFileId",
                table: "Notifications",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TargetFileId",
                table: "Notifications");
        }
    }
}
