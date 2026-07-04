using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinimalAPIs.Migrations
{
    /// <inheritdoc />
    public partial class RemoveFilePathUseFileUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FilePath",
                table: "FileVersions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FilePath",
                table: "FileVersions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }
    }
}
