namespace AndritzVendorPortal.Application.Common.Models;

/// <summary>
/// Generic API response wrapper. All successful responses return Result&lt;T&gt;
/// or Result, all failures flow through the global exception middleware.
/// </summary>
public class Result
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = [];

    public static Result Ok(string? message = null) => new()
    {
        Success = true,
        Message = message
    };

    public static Result Fail(string message, IReadOnlyList<string>? errors = null) => new()
    {
        Success = false,
        Message = message,
        Errors = errors ?? []
    };
}

public class Result<T> : Result
{
    public T? Data { get; init; }

    public static Result<T> Ok(T data, string? message = null) => new()
    {
        Success = true,
        Message = message,
        Data = data
    };

    public new static Result<T> Fail(string message, IReadOnlyList<string>? errors = null) => new()
    {
        Success = false,
        Message = message,
        Errors = errors ?? []
    };
}
