using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Domain.Entities;
using AutoMapper;
using System.Text.Json;

namespace AndritzVendorPortal.Application.Common.Mappings;

public class MappingProfile : Profile
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public MappingProfile()
    {
        CreateMap<ApprovalStep, ApprovalStepDto>();

        CreateMap<VendorRevision, VendorRevisionDto>()
            .ForCtorParam(nameof(VendorRevisionDto.RevisionType),
                opt => opt.MapFrom(src => src.RevisionType.ToString()))
            .ForCtorParam(nameof(VendorRevisionDto.Changes),
                opt => opt.MapFrom(src => DeserializeChanges(src.ChangesJson)));

        CreateMap<VendorRequest, VendorRequestDetailDto>()
            .ForCtorParam(nameof(VendorRequestDetailDto.PendingApproverUserIds),
                opt => opt.MapFrom(src => new List<string>()))
            .ForCtorParam(nameof(VendorRequestDetailDto.ApprovalSteps),
                opt => opt.MapFrom(src => src.ApprovalSteps.OrderBy(s => s.StepOrder)))
            .ForCtorParam(nameof(VendorRequestDetailDto.RevisionHistory),
                opt => opt.MapFrom(src => src.RevisionHistory.OrderBy(v => v.RevisionNo)));
    }

    private static List<FieldChangeDto> DeserializeChanges(string json)
    {
        try
        {
            var records = JsonSerializer.Deserialize<List<FieldChangeRecord>>(json, JsonOpts);
            return records?.Select(c => new FieldChangeDto(c.Field, c.FieldLabel, c.OldValue, c.NewValue)).ToList()
                ?? [];
        }
        catch
        {
            return [];
        }
    }
}
