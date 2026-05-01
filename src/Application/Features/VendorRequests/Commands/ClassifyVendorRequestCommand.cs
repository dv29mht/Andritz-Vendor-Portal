using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Enums;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record ClassifyVendorRequestCommand(int Id, bool IsOneTimeVendor) : IRequest<VendorRequestDetailDto>;

public class ClassifyVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IDateTimeProvider clock) : IRequestHandler<ClassifyVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(ClassifyVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        if (entity.Status != VendorRequestStatus.Completed)
            throw new BadRequestException("Only completed requests can be reclassified.");

        entity.IsOneTimeVendor = request.IsOneTimeVendor;
        entity.UpdatedAt = clock.UtcNow;

        await db.SaveChangesAsync(ct);
        return VendorRequestMapper.ToDetailDto(entity);
    }
}
