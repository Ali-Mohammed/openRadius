using Polly;
using Polly.Extensions.Http;

namespace Backend.Configuration
{
    /// <summary>
    /// Resilience policies for payment gateway HTTP clients
    /// Implements retry, circuit breaker, and timeout patterns
    /// </summary>
    public static class HttpClientConfiguration
    {
        public static void AddPaymentHttpClients(this IServiceCollection services)
        {
            // Configure named HttpClient for payment gateways with resilience policies
            services.AddHttpClient("PaymentGateway")
                .SetHandlerLifetime(TimeSpan.FromMinutes(5)) // Mitigate DNS changes
                .AddPolicyHandler(GetRetryPolicy())
                .AddPolicyHandler(GetCircuitBreakerPolicy())
                .AddPolicyHandler(Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(30)));
        }

        /// <summary>
        /// Exponential backoff retry policy for transient failures
        /// </summary>
        private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
        {
            return HttpPolicyExtensions
                .HandleTransientHttpError() // 5xx and 408
                .OrResult(msg => msg.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                .WaitAndRetryAsync(
                    retryCount: 3,
                    sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    onRetry: (outcome, timespan, retryCount, context) =>
                    {
                        Console.WriteLine(
                            $"Payment gateway request failed. Retry {retryCount} after {timespan.TotalSeconds}s. Status: {outcome.Result?.StatusCode}");
                    });
        }

        /// <summary>
        /// Circuit breaker to prevent cascading failures
        /// </summary>
        private static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
        {
            return HttpPolicyExtensions
                .HandleTransientHttpError()
                .CircuitBreakerAsync(
                    handledEventsAllowedBeforeBreaking: 5,
                    durationOfBreak: TimeSpan.FromSeconds(30),
                    onBreak: (outcome, breakDelay) =>
                    {
                        Console.WriteLine($"⚠️  Circuit breaker opened for {breakDelay.TotalSeconds}s");
                    },
                    onReset: () =>
                    {
                        Console.WriteLine("✅ Circuit breaker reset");
                    });
        }
    }
}
