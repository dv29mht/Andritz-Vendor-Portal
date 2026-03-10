using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AndritzVendorPortal.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDesignationAndStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "AspNetUsers",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Designation",
                table: "AspNetUsers");
        }
    }
}
