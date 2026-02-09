using Microsoft.Extensions.Diagnostics.HealthChecks;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.HealthChecks
{
    /// <summary>
    /// Health check for payment system availability and database connectivity
    /// </summary>
    public class PaymentSystemHealthCheck : IHealthCheck
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PaymentSystemHealthCheck> _logger;

        public PaymentSystemHealthCheck(
            ApplicationDbContext context,
            ILogger<PaymentSystemHealthCheck> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Check database connectivity
                var canConnect = await _context.Database.CanConnectAsync(cancellationToken);
                if (!canConnect)
                {
                    return HealthCheckResult.Unhealthy("Cannot connect to payment database");
                }

                // Check if PaymentLogs table is accessible
                var recentPaymentsCount = await _context.PaymentLogs
                    .Where(p => p.CreatedAt >= DateTime.UtcNow.AddMinutes(-5))
                    .CountAsync(cancellationToken);

                // Check for stuck pending payments (over 1 hour old)
                var stuckPayments = await _context.PaymentLogs
                    .Where(p => p.Status == "pending" && p.CreatedAt < DateTime.UtcNow.AddHours(-1))
                    .CountAsync(cancellationToken);

                var data = new Dictionary<string, object>
                {
                    { "recent_payments_5min", recentPaymentsCount },
                    { "stuck_pending_payments", stuckPayments },
                    { "database_connected", true }
                };

                if (stuckPayments > 10)
                {
                    return HealthCheckResult.Degraded(
                        $"Payment system degraded: {stuckPayments} stuck pending payments",
                        data: data);
                }

                return HealthCheckResult.Healthy("Payment system operational", data: data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Payment system health check failed");
                return HealthCheckResult.Unhealthy(
                    "Payment system health check failed",
                    exception: ex);
            }
        }
    }

    /// <summary>
    /// Health check for payment gateway connectivity
    /// </summary>
    public class PaymentGatewayHealthCheck : IHealthCheck
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<PaymentGatewayHealthCheck> _logger;
        private readonly IConfiguration _configuration;

        public PaymentGatewayHealthCheck(
            IHttpClientFactory httpClientFactory,
            ILogger<PaymentGatewayHealthCheck> logger,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            var gatewayStatuses = new Dictionary<string, object>();

            // You can add actual gateway health checks here
            // For now, we'll just return a placeholder
            gatewayStatuses["zaincash"] = "not_checked";
            gatewayStatuses["qicard"] = "not_checked";
            gatewayStatuses["switch"] = "not_checked";

            return HealthCheckResult.Healthy(
                "Payment gateways status",
                data: gatewayStatuses);
        }
    }
}
