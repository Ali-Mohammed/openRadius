using Backend.DTOs;
using Backend.Models.Payments;

namespace Backend.Services
{
    /// <summary>
    /// Interface for payment gateway operations
    /// Provides abstraction for different payment providers
    /// </summary>
    public interface IPaymentGatewayService
    {
        /// <summary>
        /// Initiates a payment with the specified gateway
        /// </summary>
        Task<PaymentInitiationResponse> InitiatePaymentAsync(
            string gateway, 
            decimal amount, 
            string currency, 
            string transactionId, 
            int userId,
            Dictionary<string, object> gatewaySettings);

        /// <summary>
        /// Verifies a payment callback from the gateway
        /// </summary>
        Task<PaymentVerificationResult> VerifyPaymentAsync(
            string gateway, 
            string transactionId, 
            Dictionary<string, string> callbackData);

        /// <summary>
        /// Retrieves payment status from the gateway
        /// </summary>
        Task<PaymentStatusResponse> GetPaymentStatusAsync(
            string gateway, 
            string referenceId, 
            Dictionary<string, object> gatewaySettings);
    }

    /// <summary>
    /// Result of payment verification
    /// </summary>
    public class PaymentVerificationResult
    {
        public bool IsValid { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? ErrorMessage { get; set; }
        public Dictionary<string, object>? AdditionalData { get; set; }
    }
}
