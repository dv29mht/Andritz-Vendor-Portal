namespace AndritzVendorPortal.Domain.Common;

public interface ISoftDelete
{
    bool IsArchived { get; set; }
    DateTime? ArchivedAt { get; set; }
}
