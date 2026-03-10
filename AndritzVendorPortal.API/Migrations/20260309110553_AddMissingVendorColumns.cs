using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AndritzVendorPortal.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingVendorColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContactPerson",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Incoterms",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MaterialGroup",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PostalCode",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Telephone",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "YearlyPvo",
                table: "VendorRequests",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContactPerson",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "Incoterms",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "MaterialGroup",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "PostalCode",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "State",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "Telephone",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "YearlyPvo",
                table: "VendorRequests");
        }
    }
}
