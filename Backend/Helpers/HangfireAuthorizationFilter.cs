using Hangfire.Dashboard;

namespace Backend.Helpers;

public class HangfireAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        
        // Allow access if user is authenticated
        return httpContext.User.Identity?.IsAuthenticated ?? false;
    }
}
