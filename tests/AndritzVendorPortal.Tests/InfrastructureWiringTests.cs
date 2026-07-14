using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Infrastructure;
using AndritzVendorPortal.Infrastructure.Identity;
using AndritzVendorPortal.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// Two guarantees that live in the composition root rather than in any one class, and that would
/// otherwise regress silently.
/// </summary>
public class InfrastructureWiringTests
{
    private static IServiceCollection Services(params (string Key, string? Value)[] overrides)
    {
        var settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "Server=(local);Database=Sot;Trusted_Connection=True",
            ["JwtSettings:SecretKey"] = "Test-Only-Signing-Key-At-Least-32-Characters-Long",
        };
        foreach (var (key, value) in overrides) settings[key] = value;

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(new ConfigurationBuilder().AddInMemoryCollection(settings).Build());
        return services;
    }

    [Fact]
    public void Identity_and_the_outbox_share_one_DbContext()
    {
        // This is what makes CreateUserCommand atomic. It stages the invite mail on IApplicationDbContext
        // and then calls CreateUserAsync; UserManager's store saves through *this same context*, so the
        // new user row and the queued invite go out in one SaveChanges — one transaction. Move Identity
        // onto its own context and that silently becomes two commits again, with the old failure back:
        // a 500 mid-way leaves an account that exists, was never invited, and can never be re-created
        // because the email is taken.
        using var provider = Services().BuildServiceProvider();
        using var scope = provider.CreateScope();
        var sp = scope.ServiceProvider;

        var context = sp.GetRequiredService<ApplicationDbContext>();

        // AddEntityFrameworkStores builds a UserStore closed over nine type arguments; its DbContext
        // is what we are after, not its exact shape.
        var store = sp.GetRequiredService<IUserStore<ApplicationUser>>();
        var storeContext = store.GetType().GetProperty("Context")?.GetValue(store);

        Assert.Same(context, storeContext);
        Assert.Same(context, sp.GetRequiredService<IApplicationDbContext>());
    }

    [Fact]
    public void A_username_with_no_password_refuses_to_boot()
    {
        // The username is committed to appsettings.json and the password comes from the environment,
        // so a forgotten EmailSettings__Password looks exactly like this. Left unchecked, the app boots
        // healthy and authenticates as (username, "") on every send: every message fails auth, burns its
        // retries over ~45 minutes of backoff, and is abandoned — a total mail outage, visible only in
        // the logs.
        var ex = Assert.Throws<InvalidOperationException>(() =>
            Services(("EmailSettings:Username", "SCMVendoApprovalNotification")));

        Assert.Contains("EmailSettings:Password", ex.Message);
    }

    [Fact]
    public void An_anonymous_relay_boots_without_a_password()
    {
        // A relay that takes anonymous internal mail is legitimate — MailKitEmailService only
        // authenticates when a username is set — so the guard is on the pair, not the password alone.
        // (Local dev is exactly this: MailHog, no credentials.)
        Services(("EmailSettings:Username", ""), ("EmailSettings:Host", "localhost"));
    }

    [Fact]
    public void A_username_with_a_password_boots()
    {
        Services(("EmailSettings:Username", "SCMVendoApprovalNotification"), ("EmailSettings:Password", "s3cret"));
    }
}
