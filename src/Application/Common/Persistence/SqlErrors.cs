namespace AndritzVendorPortal.Application.Common.Persistence;

/// <summary>
/// Provider-error classification shared by the handlers that catch a collision at the source
/// (CompleteVendorRequestCommand) and by GlobalExceptionMiddleware, which is the last line of
/// defence for the ones nobody caught. One implementation, so the two cannot drift.
/// </summary>
public static class SqlErrors
{
    /// <summary>
    /// SQL Server raises error 2627 (unique constraint) / 2601 (unique index) on a duplicate key.
    ///
    /// <para>The provider exception lives in Microsoft.Data.SqlClient, which neither the Application
    /// layer nor the API project references, so <c>Number</c> is read reflectively. The whole
    /// InnerException chain is walked: EF wraps the SqlException in a DbUpdateException, and a
    /// SaveChanges made through an execution strategy or an interceptor can wrap it again.</para>
    /// </summary>
    public static bool IsUniqueConstraintViolation(Exception? ex)
    {
        for (var current = ex; current is not null; current = current.InnerException)
        {
            if (current.GetType().GetProperty("Number")?.GetValue(current) is int number
                && number is 2627 or 2601)
                return true;
        }

        return false;
    }
}
