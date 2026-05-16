using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// Mirrors the frontend's <c>exportRequestToPdf</c> HTML print layout
/// (BuyerConsole.jsx) so the email-attached PDF looks identical to the
/// one users download from the portal.
/// </summary>
public class QuestPdfVendorRequestPdfService : IVendorRequestPdfService
{
    // Tailwind-ish palette mirroring the HTML print stylesheet.
    private const string TextDark   = "#1f2937"; // body
    private const string Muted      = "#6b7280"; // h2
    private const string Label      = "#9ca3af"; // .lbl
    private const string BorderLine = "#e5e7eb"; // h2 underline
    private const string RowLine    = "#f3f4f6"; // td border
    private const string GreenBg    = "#d1fae5"; // badge bg
    private const string GreenFg    = "#065f46"; // badge fg

    public byte[] Generate(VendorRequest r)
    {
        return Document.Create(doc =>
        {
            doc.Page(p =>
            {
                p.Size(PageSizes.A4);
                p.Margin(28);
                p.DefaultTextStyle(t => t.FontSize(10).FontColor(TextDark).FontFamily(Fonts.Arial));

                p.Content().Element(c => Body(c, r));
                p.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(9).FontColor(Muted));
                    t.Span("Andritz Vendor Portal · Generated ");
                    t.Span($"{DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC");
                    t.Span("  ·  Page ");
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        }).GeneratePdf();
    }

    private static void Body(IContainer c, VendorRequest r)
    {
        c.Column(col =>
        {
            // ── Header: vendor name + status badge ──
            col.Item().Row(row =>
            {
                row.AutoItem().PaddingRight(8).Text(r.VendorName).FontSize(15).Bold();
                row.AutoItem().AlignMiddle().Background(GreenBg).PaddingHorizontal(8).PaddingVertical(2)
                    .Text(StatusLabel(r.Status)).FontSize(9).Bold().FontColor(GreenFg);
            });

            if (!string.IsNullOrWhiteSpace(r.VendorCode))
            {
                col.Item().PaddingTop(4).Text(t =>
                {
                    t.Span("SAP Vendor Code: ").FontSize(11).Bold().FontColor(GreenFg);
                    t.Span(r.VendorCode!).FontSize(13).Bold().FontColor(GreenFg).FontFamily(Fonts.Consolas);
                });
            }

            // ── Sections ──
            col.Item().Element(e => Section(e, "Vendor Information", new (string, string)[]
            {
                ("Material Group", r.MaterialGroup),
                ("Reason", r.Reason),
                ("GST Number", r.GstNumber),
                ("PAN Card", r.PanCard),
                ("One-Time Vendor", r.IsOneTimeVendor ? "Yes" : "No"),
                ("Proposed By", r.ProposedBy),
                ("Purchasing Organization", r.PurchasingOrganization),
                ("MSME Category", string.IsNullOrWhiteSpace(r.MsmeCategory) ? "N/A" : r.MsmeCategory),
            }));

            col.Item().Element(e => Section(e, "Address", new (string, string)[]
            {
                ("Street / Building", r.AddressDetails),
                ("City", r.City),
                ("Locality", r.Locality),
                ("State", r.State),
                ("Postal Code", r.PostalCode),
                ("Country", r.Country),
            }));

            col.Item().Element(e => Section(e, "Commercial Terms", new (string, string)[]
            {
                ("Currency", r.Currency),
                ("Payment Terms", r.PaymentTerms),
                ("Incoterms", r.Incoterms),
                ("Yearly PVO", r.YearlyPvo),
            }));

            col.Item().Element(e => Section(e, "Contact", new (string, string)[]
            {
                ("Contact Person", string.IsNullOrWhiteSpace(r.ContactPerson) ? r.ContactInformation : r.ContactPerson),
                ("Telephone", r.Telephone),
            }));

            col.Item().Element(e => Section(e, "Bank Details", new (string, string)[]
            {
                ("Bank Name", r.BankName),
                ("Branch Name", r.BranchName),
                ("Account Number", r.BankAccountNumber),
                ("IFSC Code", r.IfscCode),
            }));

            col.Item().Element(e => Section(e, "Record", new (string, string)[]
            {
                ("Created By", r.CreatedByName),
                ("Created On", r.CreatedAt.ToString("yyyy-MM-dd HH:mm 'UTC'")),
                ("Last Updated", r.UpdatedAt.ToString("yyyy-MM-dd HH:mm 'UTC'")),
                ("Assigned By", r.VendorCodeAssignedBy ?? ""),
                ("Revision No.", r.RevisionNo.ToString()),
            }));

            col.Item().Element(e => ApprovalChainSection(e, r));
        });
    }

    private static void Section(IContainer c, string title, (string Label, string Value)[] rows)
    {
        c.PaddingTop(12).Column(col =>
        {
            col.Item().PaddingBottom(4).BorderBottom(1).BorderColor(BorderLine)
                .Text(title.ToUpperInvariant()).FontSize(9).Bold().FontColor(Muted);

            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    d.RelativeColumn(35);
                    d.RelativeColumn(65);
                });
                foreach (var (label, value) in rows)
                {
                    table.Cell().BorderBottom(1).BorderColor(RowLine).PaddingVertical(3).PaddingRight(8)
                        .Text(label).FontSize(9).FontColor(Label);
                    table.Cell().BorderBottom(1).BorderColor(RowLine).PaddingVertical(3)
                        .Text(string.IsNullOrWhiteSpace(value) ? "—" : value).FontSize(10);
                }
            });
        });
    }

    private static void ApprovalChainSection(IContainer c, VendorRequest r)
    {
        c.PaddingTop(12).Column(col =>
        {
            col.Item().PaddingBottom(4).BorderBottom(1).BorderColor(BorderLine)
                .Text("APPROVAL CHAIN").FontSize(9).Bold().FontColor(Muted);

            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    d.ConstantColumn(24);
                    d.RelativeColumn(3);
                    d.RelativeColumn(2);
                    d.RelativeColumn(2);
                });
                table.Header(h =>
                {
                    h.Cell().PaddingBottom(4).Text("#").FontSize(8).Bold().FontColor(Label);
                    h.Cell().PaddingBottom(4).Text("Approver").FontSize(8).Bold().FontColor(Label);
                    h.Cell().PaddingBottom(4).Text("Decision").FontSize(8).Bold().FontColor(Label);
                    h.Cell().PaddingBottom(4).Text("Updated On").FontSize(8).Bold().FontColor(Label);
                });

                foreach (var step in r.ApprovalSteps.OrderBy(s => s.StepOrder))
                {
                    table.Cell().BorderBottom(1).BorderColor(RowLine).PaddingVertical(3)
                        .Text(step.StepOrder.ToString()).FontSize(9);
                    table.Cell().BorderBottom(1).BorderColor(RowLine).PaddingVertical(3).Column(c2 =>
                    {
                        c2.Item().Text(step.ApproverName + (step.IsFinalApproval ? " (Final)" : "")).FontSize(10);
                        if (!string.IsNullOrWhiteSpace(step.Comment))
                            c2.Item().Text($"“{step.Comment}”").FontSize(8).FontColor(Muted).Italic();
                        if (step.IsDeletedApprover)
                            c2.Item().Text("[Approver removed]").FontSize(8).FontColor(Label);
                    });
                    table.Cell().BorderBottom(1).BorderColor(RowLine).PaddingVertical(3)
                        .Text(step.Decision.ToString()).FontSize(9).FontColor(DecisionColor(step.Decision));
                    table.Cell().BorderBottom(1).BorderColor(RowLine).PaddingVertical(3)
                        .Text(step.DecidedAt?.ToString("yyyy-MM-dd HH:mm 'UTC'") ?? "—").FontSize(9);
                }
            });
        });
    }

    private static string StatusLabel(VendorRequestStatus s) => s switch
    {
        VendorRequestStatus.PendingApproval      => "Pending Approval",
        VendorRequestStatus.PendingFinalApproval => "Pending Final Approval",
        _ => s.ToString()
    };

    private static string DecisionColor(ApprovalDecision d) => d switch
    {
        ApprovalDecision.Approved => "#065f46",
        ApprovalDecision.Rejected => "#991b1b",
        _ => "#92400e"
    };
}
