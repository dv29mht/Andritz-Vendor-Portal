using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AndritzVendorPortal.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorExtendedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VendorRequests_VendorCode",
                table: "VendorRequests");

            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                table: "VendorRequests",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BankDocument1",
                table: "VendorRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BankDocument2",
                table: "VendorRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "VendorRequests",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BranchName",
                table: "VendorRequests",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "GstDocument",
                table: "VendorRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IfscCode",
                table: "VendorRequests",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MsmeCategory",
                table: "VendorRequests",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PanDocument",
                table: "VendorRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PurchasingOrganization",
                table: "VendorRequests",
                type: "varchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_VendorRequests_VendorCode",
                table: "VendorRequests",
                column: "VendorCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VendorRequests_VendorCode",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "BankDocument1",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "BankDocument2",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "BranchName",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "GstDocument",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "IfscCode",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "MsmeCategory",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "PanDocument",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "PurchasingOrganization",
                table: "VendorRequests");

            migrationBuilder.CreateIndex(
                name: "IX_VendorRequests_VendorCode",
                table: "VendorRequests",
                column: "VendorCode",
                unique: true,
                filter: "[VendorCode] IS NOT NULL");
        }
    }
}
