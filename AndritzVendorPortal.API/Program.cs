app.UseAuthentication();
app.UseAuthorization();

// ── 1. MAP CONTROLLERS (Missing in your snippet) ──────────────────────────────
app.MapControllers();

// ── 2. CALL THE SEEDER (This was missing!) ────────────────────────────────────
// We wrap this in a try-catch so one database error doesn't kill the whole app.
try 
{
    Console.WriteLine("🚀 Attempting to seed data...");
    DbInitializer.SeedData(app);
    Console.WriteLine("✅ Seeding logic completed.");
}
catch (Exception ex)
{
    Console.WriteLine($"⚠️ Seeding failed but app will continue: {ex.Message}");
}

// ── 3. FINISH THE STARTUP ─────────────────────────────────────────────────────
app.Run();

// ── 4. THE STATIC CLASS DEFINITION ────────────────────────────────────────────
public static class DbInitializer
{
    public static void SeedData(IHost host)
    {
        using var scope = host.Services.CreateScope();
        var services = scope.ServiceProvider;
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var context = services.GetRequiredService<ApplicationDbContext>();

        context.Database.EnsureCreated();

        string[] roleNames = { "Buyer", "Approver", "FinalApprover", "Admin" };
        foreach (var roleName in roleNames)
        {
            if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult())
            {
                roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
            }
        }

        var seedData = new[] {
            (Email: "vikram.nair@andritz.com", Name: "Vikram Nair", Role: "Buyer", Pass: "Buyer@123!"),
            (Email: "rajesh.kumar@andritz.com", Name: "Rajesh Kumar", Role: "Approver", Pass: "Approver@123!"),
            (Email: "pardeep.sharma@andritz.com", Name: "Pardeep Sharma", Role: "FinalApprover", Pass: "ChangeMe1!"),
            (Email: "admin@andritz.com", Name: "System Admin", Role: "Admin", Pass: "Admin@123!")
        };

        foreach (var data in seedData)
        {
            var existingUser = userManager.FindByEmailAsync(data.Email).GetAwaiter().GetResult();
            if (existingUser == null)
            {
                var user = new ApplicationUser 
                { 
                    UserName = data.Email, 
                    Email = data.Email, 
                    FullName = data.Name, 
                    Designation = data.Role,
                    NormalizedUserName = data.Email.ToUpper(),
                    NormalizedEmail = data.Email.ToUpper(),
                    EmailConfirmed = true 
                };
                
                var result = userManager.CreateAsync(user, data.Pass).GetAwaiter().GetResult();
                if (result.Succeeded)
                {
                    userManager.AddToRoleAsync(user, data.Role).GetAwaiter().GetResult();
                    Console.WriteLine($"✅ Seeded: {data.Email}");
                }
                else
                {
                    Console.WriteLine($"❌ FAILED {data.Email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                }
            }
        }
        context.SaveChanges();
    }
}