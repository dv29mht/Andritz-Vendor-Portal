using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Enums;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record ArchiveVendorRequestCommand(int Id) : IRequest<Unit>;

public class ArchiveVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IDateTimeProvider clock) : IRequestHandler<ArchiveVendorRequestCommand, Unit>
{
    public async Task<Unit> Handle(ArchiveVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        if (entity.Status != VendorRequestStatus.Rejected && entity.Status != VendorRequestStatus.Completed)
            throw new BadRequestException("Only Rejected or Completed requests can be archived.");

        entity.IsArchived = true;
        entity.ArchivedAt = clock.UtcNow;
        entity.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record RestoreVendorRequestCommand(int Id) : IRequest<Unit>;

public class RestoreVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IDateTimeProvider clock) : IRequestHandler<RestoreVendorRequestCommand, Unit>
{
    public async Task<Unit> Handle(RestoreVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        entity.IsArchived = false;
        entity.ArchivedAt = null;
        entity.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
