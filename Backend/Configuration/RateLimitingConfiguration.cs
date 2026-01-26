using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

namespace Backend.Configuration
{
    /// <summary>
    /// Enterprise-grade rate limiting configuration for payment endpoints
    /// Protects against abuse and ensures fair resource usage
    /// </summary>
    public static class RateLimitingConfiguration
    {
        public static void AddPaymentRateLimiting(this IServiceCollection services)
        {
            services.AddRateLimiter(options =>
            {
                // Fixed window rate limiting for payment initiation
                options.AddFixedWindowLimiter("fixed", opt =>
                {
                    opt.Window = TimeSpan.FromMinutes(1);
                    opt.PermitLimit = 10; // 10 payment initiations per minute per user
                    opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                    opt.QueueLimit = 2;
                });

                // Sliding window for callback endpoints
                options.AddSlidingWindowLimiter("sliding", opt =>
                {
                    opt.Window = TimeSpan.FromSeconds(30);
                    opt.PermitLimit = 5;
                    opt.SegmentsPerWindow = 3;
                    opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                    opt.QueueLimit = 1;
                });

                // Concurrency limiter for webhook processing
                options.AddConcurrencyLimiter("webhook", opt =>
                {
                    opt.PermitLimit = 10;
                    opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                    opt.QueueLimit = 5;
                });

                // Global rate limit
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: context.User.Identity?.Name ?? context.Request.Headers.Host.ToString(),
                        factory: partition => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 100,
                            Window = TimeSpan.FromMinutes(1)
                        });
                });

                options.OnRejected = async (context, token) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsJsonAsync(new
                    {
                        error = "Too many requests",
                        message = "Rate limit exceeded. Please try again later.",
                        retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter) 
                            ? retryAfter.ToString() 
                            : "60 seconds"
                    }, cancellationToken: token);
                };
            });
        }
    }
}
