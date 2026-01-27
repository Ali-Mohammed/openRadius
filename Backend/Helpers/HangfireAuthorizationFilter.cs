using Hangfire.Dashboard;

namespace Backend.Helpers;

public class HangfireAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        
        // In development, allow access without authentication
        // In production, you should enable authentication
        return true;
        
        // For production, use:
        // return httpContext.User.Identity?.IsAuthenticated ?? false;
    }
}
