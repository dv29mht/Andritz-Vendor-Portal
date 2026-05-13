using AndritzVendorPortal.Domain.Entities;

namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Renders a vendor request to a branded A4 PDF, suitable for attaching to approval-stage emails.
/// </summary>
public interface IVendorRequestPdfService
{
    byte[] Generate(VendorRequest request);
}
