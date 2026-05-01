namespace AndritzVendorPortal.Domain.Common;

public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
    string? CreatedBy { get; set; }
    string? ModifiedBy { get; set; }
}
