namespace AndritzVendorPortal.Application.Common.Exceptions;

public class AppException : Exception
{
    public AppException(string message) : base(message) { }
    public AppException(string message, Exception inner) : base(message, inner) { }
}

public class NotFoundException : AppException
{
    public NotFoundException(string entity, object key)
        : base($"{entity} with key '{key}' was not found.") { }
    public NotFoundException(string message) : base(message) { }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "Access denied.") : base(message) { }
}

public class ConflictException : AppException
{
    public ConflictException(string message) : base(message) { }
}

public class BadRequestException : AppException
{
    public IReadOnlyList<string> Errors { get; }
    public BadRequestException(string message, IReadOnlyList<string>? errors = null) : base(message)
    {
        Errors = errors ?? [];
    }
}

public class ValidationException : AppException
{
    public IDictionary<string, string[]> Errors { get; }

    public ValidationException(IDictionary<string, string[]> errors)
        : base("One or more validation failures occurred.")
    {
        Errors = errors;
    }
}

public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Authentication required.") : base(message) { }
}
