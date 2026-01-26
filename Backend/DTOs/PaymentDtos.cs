using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs
{
    // Request to initialize a payment
    public class InitiatePaymentDto
    {
        [Required]
        public int PaymentMethodId { get; set; }

        [Required]
        [Range(250, 149999, ErrorMessage = "Amount must be between 250 and 149,999 IQD")]
        public decimal Amount { get; set; }

        public string ServiceType { get; set; } = "wallet_topup";
    }

    // Response from payment initialization
    public class PaymentInitiationResponse
    {
        public bool Success { get; set; }
        public string? PaymentUrl { get; set; }
        public string? TransactionId { get; set; }
        public string? ErrorMessage { get; set; }
        public object? AdditionalData { get; set; }
    }

    // ZainCash specific response
    public class ZainCashInitResponse
    {
        public string? Id { get; set; }
        public string? Status { get; set; }
        public string? Message { get; set; }
    }

    // Switch specific response  
    public class SwitchInitResponse
    {
        public string? Id { get; set; }
        public string? Ndc { get; set; }
        public bool? Integrity { get; set; }
        public string? Result { get; set; }
    }

    // Payment callback data
    public class PaymentCallbackDto
    {
        public string? Token { get; set; } // For ZainCash
        public string? Id { get; set; } // For Switch
        public string? CheckoutId { get; set; }
        public string? ResourcePath { get; set; }
    }

    // Payment status check
    public class PaymentStatusResponse
    {
        public string TransactionId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = string.Empty;
        public string Gateway { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? ErrorMessage { get; set; }
    }

    // Wallet balance response
    public class WalletBalanceResponse
    {
        public decimal CurrentBalance { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal? DailySpendingLimit { get; set; }
        public decimal? MaxFillLimit { get; set; }
    }
}
