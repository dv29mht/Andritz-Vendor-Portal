using AndritzVendorPortal.Application.Interfaces;

namespace AndritzVendorPortal.Infrastructure.Services;

public class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
