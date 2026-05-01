namespace AndritzVendorPortal.Application.Interfaces;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
