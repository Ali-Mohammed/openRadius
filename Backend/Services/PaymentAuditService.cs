using Backend.Data;
using Backend.Models.Payments;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Backend.Services
{
    /// <summary>
    /// Service for comprehensive payment auditing and compliance logging
    /// Implements best practices for financial transaction tracking
    /// </summary>
    public class PaymentAuditService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PaymentAuditService> _logger;

        public PaymentAuditService(
            ApplicationDbContext context,
            ILogger<PaymentAuditService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Logs a payment attempt with full audit trail
        /// </summary>
        public async Task<PaymentLog> LogPaymentAttemptAsync(
            string gateway,
            string transactionId,
            int userId,
            decimal amount,
            string currency,
            object? requestData = null,
            string? serviceType = null)
        {
            var paymentLog = new PaymentLog
            {
                Gateway = gateway,
                TransactionId = transactionId,
                UserId = userId,
                Amount = amount,
                Currency = currency,
                Status = "pending",
                ServiceType = serviceType ?? "wallet_topup",
                RequestData = requestData != null ? JsonSerializer.Serialize(requestData) : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.PaymentLogs.Add(paymentLog);
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Payment attempt logged: Gateway={Gateway}, TransactionId={TransactionId}, UserId={UserId}, Amount={Amount} {Currency}",
                gateway, transactionId, userId, amount, currency);

            return paymentLog;
        }

        /// <summary>
        /// Updates payment status with comprehensive tracking
        /// </summary>
        public async Task<PaymentLog?> UpdatePaymentStatusAsync(
            string transactionId,
            string status,
            string? errorMessage = null,
            object? responseData = null,
            object? callbackData = null)
        {
            var paymentLog = await _context.PaymentLogs
                .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

            if (paymentLog == null)
            {
                _logger.LogWarning("Payment log not found for transaction: {TransactionId}", transactionId);
                return null;
            }

            var previousStatus = paymentLog.Status;
            paymentLog.Status = status;
            paymentLog.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(errorMessage))
            {
                paymentLog.ErrorMessage = errorMessage;
            }

            if (responseData != null)
            {
                paymentLog.ResponseData = JsonSerializer.Serialize(responseData);
            }

            if (callbackData != null)
            {
                paymentLog.CallbackData = JsonSerializer.Serialize(callbackData);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Payment status updated: TransactionId={TransactionId}, {PreviousStatus} -> {NewStatus}",
                transactionId, previousStatus, status);

            return paymentLog;
        }

        /// <summary>
        /// Retrieves payment history for a user with pagination
        /// </summary>
        public async Task<(List<PaymentLog> Payments, int TotalCount)> GetUserPaymentHistoryAsync(
            int userId,
            int page = 1,
            int pageSize = 20,
            string? gateway = null,
            string? status = null)
        {
            var query = _context.PaymentLogs
                .Where(p => p.UserId == userId);

            if (!string.IsNullOrEmpty(gateway))
            {
                query = query.Where(p => p.Gateway == gateway);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(p => p.Status == status);
            }

            var totalCount = await query.CountAsync();
            
            var payments = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (payments, totalCount);
        }

        /// <summary>
        /// Gets payment statistics for monitoring and reporting
        /// </summary>
        public async Task<PaymentStatistics> GetPaymentStatisticsAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? gateway = null)
        {
            var query = _context.PaymentLogs.AsQueryable();

            if (startDate.HasValue)
            {
                query = query.Where(p => p.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(p => p.CreatedAt <= endDate.Value);
            }

            if (!string.IsNullOrEmpty(gateway))
            {
                query = query.Where(p => p.Gateway == gateway);
            }

            var stats = new PaymentStatistics
            {
                TotalPayments = await query.CountAsync(),
                SuccessfulPayments = await query.CountAsync(p => p.Status == "completed"),
                FailedPayments = await query.CountAsync(p => p.Status == "failed"),
                PendingPayments = await query.CountAsync(p => p.Status == "pending"),
                TotalAmount = await query.Where(p => p.Status == "completed").SumAsync(p => p.Amount),
                AverageAmount = await query.Where(p => p.Status == "completed").AverageAsync(p => (decimal?)p.Amount) ?? 0
            };

            stats.SuccessRate = stats.TotalPayments > 0
                ? (double)stats.SuccessfulPayments / stats.TotalPayments * 100
                : 0;

            return stats;
        }
    }

    /// <summary>
    /// Payment statistics for monitoring and reporting
    /// </summary>
    public class PaymentStatistics
    {
        public int TotalPayments { get; set; }
        public int SuccessfulPayments { get; set; }
        public int FailedPayments { get; set; }
        public int PendingPayments { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal AverageAmount { get; set; }
        public double SuccessRate { get; set; }
    }
}
