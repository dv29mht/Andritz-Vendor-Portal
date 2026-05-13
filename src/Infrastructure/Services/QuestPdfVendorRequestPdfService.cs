using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AndritzVendorPortal.Infrastructure.Services;

public class QuestPdfVendorRequestPdfService : IVendorRequestPdfService
{
    private static readonly string Brand = "#064e80";
    private static readonly string Muted = "#6b7280";
    private static readonly string TextDark = "#111827";
    private static readonly string Border = "#e5e7eb";

    public byte[] Generate(VendorRequest r)
    {
        return Document.Create(doc =>
        {
            doc.Page(p =>
            {
                p.Size(PageSizes.A4);
                p.Margin(36);
                p.DefaultTextStyle(t => t.FontSize(10).FontColor(TextDark).FontFamily("Helvetica"));

                p.Header().Element(c => Header(c, r));
                p.Content().Element(c => Body(c, r));
                p.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Andritz Vendor Portal · Generated ").FontColor(Muted).FontSize(9);
                    t.Span($"{DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontColor(Muted).FontSize(9);
                    t.Span("  ·  Page ").FontColor(Muted).FontSize(9);
                    t.CurrentPageNumber().FontColor(Muted).FontSize(9);
                    t.Span(" / ").FontColor(Muted).FontSize(9);
                    t.TotalPages().FontColor(Muted).FontSize(9);
                });
            });
        }).GeneratePdf();
    }

    private static void Header(IContainer c, VendorRequest r)
    {
        c.PaddingBottom(12).BorderBottom(2).BorderColor(Brand).Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text("ANDRITZ").FontSize(20).Bold().FontColor(Brand).LetterSpacing(3);
                col.Item().Text("Vendor Onboarding & Compliance").FontSize(9).FontColor(Muted).LetterSpacing(2);
            });
            row.ConstantItem(180).AlignRight().Column(col =>
            {
                col.Item().Text("VENDOR REQUEST").FontSize(11).Bold().FontColor(Muted).LetterSpacing(2);
                col.Item().Text($"#{r.Id}").FontSize(16).Bold().FontColor(TextDark);
                col.Item().Text(StatusLabel(r.Status)).FontSize(10).Bold().FontColor(StatusColor(r.Status));
                if (r.RevisionNo > 0)
                    col.Item().Text($"Revision REV {r.RevisionNo}").FontSize(9).FontColor(Muted);
            });
        });
    }

    private static void Body(IContainer c, VendorRequest r)
    {
        c.PaddingVertical(12).Column(col =>
        {
            col.Spacing(14);

            // Vendor details
            col.Item().Element(e => Section(e, "Vendor Details", new (string, string)[]
            {
                ("Vendor Name", r.VendorName),
                ("Material Group", r.MaterialGroup),
                ("Contact Person", r.ContactPerson),
                ("Telephone", r.Telephone),
                ("Proposed By", r.ProposedBy),
                ("One-Time Vendor", r.IsOneTimeVendor ? "Yes" : "No"),
                ("Reason", r.Reason),
            }));

            // Statutory
            col.Item().Element(e => Section(e, "Statutory", new (string, string)[]
            {
                ("GST Number", r.GstNumber),
                ("PAN Card", r.PanCard),
                ("MSME Category", string.IsNullOrWhiteSpace(r.MsmeCategory) ? "N/A" : r.MsmeCategory),
                ("Purchasing Organization", r.PurchasingOrganization),
            }));

            // Address
            col.Item().Element(e => Section(e, "Address", new (string, string)[]
            {
                ("Address", r.AddressDetails),
                ("City", r.City),
                ("Locality", r.Locality),
                ("Postal Code", r.PostalCode),
                ("State", r.State),
                ("Country", r.Country),
            }));

            // Commercial
            col.Item().Element(e => Section(e, "Commercial", new (string, string)[]
            {
                ("Currency", r.Currency),
                ("Payment Terms", r.PaymentTerms),
                ("Incoterms", r.Incoterms),
                ("Yearly PVO", r.YearlyPvo),
            }));

            // Bank
            col.Item().Element(e => Section(e, "Bank Details", new (string, string)[]
            {
                ("Bank Name", r.BankName),
                ("Branch Name", r.BranchName),
                ("Account Number", r.BankAccountNumber),
                ("IFSC Code", r.IfscCode),
            }));

            // Submission audit
            col.Item().Element(e => Section(e, "Submission", new (string, string)[]
            {
                ("Submitted By", r.CreatedByName),
                ("Submitted At", r.CreatedAt.ToString("yyyy-MM-dd HH:mm 'UTC'")),
                ("Last Updated", r.UpdatedAt.ToString("yyyy-MM-dd HH:mm 'UTC'")),
            }));

            // Approval chain
            col.Item().Element(e => ApprovalChainTable(e, r));

            if (!string.IsNullOrWhiteSpace(r.VendorCode))
            {
                col.Item().Element(e => Section(e, "SAP Assignment", new (string, string)[]
                {
                    ("SAP Vendor Code", r.VendorCode!),
                    ("Assigned By", r.VendorCodeAssignedBy ?? ""),
                    ("Assigned At", r.VendorCodeAssignedAt?.ToString("yyyy-MM-dd HH:mm 'UTC'") ?? ""),
                }));
            }
        });
    }

    private static void Section(IContainer c, string title, (string Label, string Value)[] rows)
    {
        c.Column(col =>
        {
            col.Item().PaddingBottom(6).Text(title).FontSize(11).Bold().FontColor(Brand).LetterSpacing(1);
            col.Item().Border(1).BorderColor(Border).Padding(8).Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    d.ConstantColumn(160);
                    d.RelativeColumn();
                });
                foreach (var (label, value) in rows)
                {
                    table.Cell().PaddingVertical(2).Text(label).FontSize(9).FontColor(Muted);
                    table.Cell().PaddingVertical(2).Text(string.IsNullOrWhiteSpace(value) ? "—" : value).FontSize(10);
                }
            });
        });
    }

    private static void ApprovalChainTable(IContainer c, VendorRequest r)
    {
        c.Column(col =>
        {
            col.Item().PaddingBottom(6).Text("Approval Chain").FontSize(11).Bold().FontColor(Brand).LetterSpacing(1);
            col.Item().Border(1).BorderColor(Border).Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    d.ConstantColumn(36);
                    d.RelativeColumn(3);
                    d.RelativeColumn(2);
                    d.RelativeColumn(2);
                });
                table.Header(h =>
                {
                    h.Cell().Background(Brand).Padding(6).Text("#").FontColor("#fff").FontSize(9).Bold();
                    h.Cell().Background(Brand).Padding(6).Text("Approver").FontColor("#fff").FontSize(9).Bold();
                    h.Cell().Background(Brand).Padding(6).Text("Decision").FontColor("#fff").FontSize(9).Bold();
                    h.Cell().Background(Brand).Padding(6).Text("Decided At").FontColor("#fff").FontSize(9).Bold();
                });

                foreach (var step in r.ApprovalSteps.OrderBy(s => s.StepOrder))
                {
                    table.Cell().BorderBottom(1).BorderColor(Border).Padding(6)
                        .Text(step.StepOrder.ToString()).FontSize(9);
                    table.Cell().BorderBottom(1).BorderColor(Border).Padding(6).Column(c2 =>
                    {
                        c2.Item().Text(step.ApproverName + (step.IsFinalApproval ? " (Final)" : "")).FontSize(10);
                        if (!string.IsNullOrWhiteSpace(step.Comment))
                            c2.Item().Text($"“{step.Comment}”").FontSize(9).FontColor(Muted).Italic();
                        if (step.IsDeletedApprover)
                            c2.Item().Text("[Approver removed]").FontSize(8).FontColor("#9ca3af");
                    });
                    table.Cell().BorderBottom(1).BorderColor(Border).Padding(6)
                        .Text(step.Decision.ToString()).FontSize(9).FontColor(DecisionColor(step.Decision));
                    table.Cell().BorderBottom(1).BorderColor(Border).Padding(6)
                        .Text(step.DecidedAt?.ToString("yyyy-MM-dd HH:mm 'UTC'") ?? "—").FontSize(9);
                }
            });
        });
    }

    private static string StatusLabel(VendorRequestStatus s) => s switch
    {
        VendorRequestStatus.Draft => "Draft",
        VendorRequestStatus.PendingApproval => "Pending Approval",
        VendorRequestStatus.PendingFinalApproval => "Pending Final Approval",
        VendorRequestStatus.Rejected => "Rejected",
        VendorRequestStatus.Completed => "Completed",
        _ => s.ToString()
    };

    private static string StatusColor(VendorRequestStatus s) => s switch
    {
        VendorRequestStatus.Completed => "#10b981",
        VendorRequestStatus.Rejected => "#ef4444",
        VendorRequestStatus.PendingFinalApproval => "#8b5cf6",
        VendorRequestStatus.PendingApproval => "#f59e0b",
        _ => Muted
    };

    private static string DecisionColor(ApprovalDecision d) => d switch
    {
        ApprovalDecision.Approved => "#10b981",
        ApprovalDecision.Rejected => "#ef4444",
        _ => "#f59e0b"
    };
}
