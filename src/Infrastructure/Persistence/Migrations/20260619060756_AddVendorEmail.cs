using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AndritzVendorPortal.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "VendorRequests",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Email",
                table: "VendorRequests");
        }
    }
}
