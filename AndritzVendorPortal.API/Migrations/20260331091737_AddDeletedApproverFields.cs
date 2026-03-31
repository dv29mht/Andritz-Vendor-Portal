using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AndritzVendorPortal.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDeletedApproverFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAt",
                table: "VendorRequests",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "VendorRequests",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsOneTimeVendor",
                table: "VendorRequests",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ProposedBy",
                table: "VendorRequests",
                type: "TEXT",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DeletedApproverNote",
                table: "ApprovalSteps",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeletedApprover",
                table: "ApprovalSteps",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_VendorRequests_VendorCode",
                table: "VendorRequests",
                column: "VendorCode",
                unique: true,
                filter: "\"VendorCode\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalSteps_ApproverUserId",
                table: "ApprovalSteps",
                column: "ApproverUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VendorRequests_VendorCode",
                table: "VendorRequests");

            migrationBuilder.DropIndex(
                name: "IX_ApprovalSteps_ApproverUserId",
                table: "ApprovalSteps");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "IsOneTimeVendor",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "ProposedBy",
                table: "VendorRequests");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "DeletedApproverNote",
                table: "ApprovalSteps");

            migrationBuilder.DropColumn(
                name: "IsDeletedApprover",
                table: "ApprovalSteps");
        }
    }
}
