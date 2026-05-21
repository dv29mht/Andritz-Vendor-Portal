using System.Text.Json;
using System.Text.Json.Serialization;

namespace AndritzVendorPortal.API.Json;

// EF Core returns DateTime values with Kind=Unspecified, which causes
// System.Text.Json to serialize them without a 'Z' suffix. JavaScript clients
// then interpret the string as local time. These converters always emit UTC ISO
// 8601 with 'Z' so the wire format is unambiguous and the frontend can render
// in a fixed time zone (IST).
public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
        writer.WriteStringValue(utc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
    }
}

public sealed class UtcNullableDateTimeConverter : JsonConverter<DateTime?>
{
    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) { writer.WriteNullValue(); return; }
        var v = value.Value;
        var utc = v.Kind switch
        {
            DateTimeKind.Utc => v,
            DateTimeKind.Local => v.ToUniversalTime(),
            _ => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        };
        writer.WriteStringValue(utc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
    }
}
