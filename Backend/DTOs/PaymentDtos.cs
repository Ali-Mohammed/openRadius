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

    // ZainCash V2 specific response (OAuth2 + REST API)
    public class ZainCashV2TokenResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("scope")]
        public string? Scope { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("token_type")]
        public string? TokenType { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }

    public class ZainCashV2InitResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("status")]
        public string? Status { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("transactionDetails")]
        public ZainCashV2TransactionDetails? TransactionDetails { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("redirectUrl")]
        public string? RedirectUrl { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("expiryTime")]
        public string? ExpiryTime { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("createdAt")]
        public string? CreatedAt { get; set; }
    }

    public class ZainCashV2TransactionDetails
    {
        [System.Text.Json.Serialization.JsonPropertyName("transactionId")]
        public string? TransactionId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("externalReferenceId")]
        public string? ExternalReferenceId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("orderId")]
        public string? OrderId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("operationId")]
        public string? OperationId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("amount")]
        public ZainCashV2Amount? Amount { get; set; }
    }

    public class ZainCashV2Amount
    {
        [System.Text.Json.Serialization.JsonPropertyName("currency")]
        public string? Currency { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("value")]
        public decimal Value { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("feeValue")]
        public decimal FeeValue { get; set; }
    }

    public class ZainCashV2InquiryResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("status")]
        public string? Status { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("transactionDetails")]
        public ZainCashV2TransactionDetails? TransactionDetails { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("customer")]
        public ZainCashV2Customer? Customer { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("timeStamps")]
        public ZainCashV2TimeStamps? TimeStamps { get; set; }
    }

    public class ZainCashV2Customer
    {
        [System.Text.Json.Serialization.JsonPropertyName("phone")]
        public string? Phone { get; set; }
    }

    public class ZainCashV2TimeStamps
    {
        [System.Text.Json.Serialization.JsonPropertyName("expiryTime")]
        public string? ExpiryTime { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("createdAt")]
        public string? CreatedAt { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("updatedAt")]
        public string? UpdatedAt { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("completedAt")]
        public string? CompletedAt { get; set; }
    }

    public class ZainCashV2ReverseResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public int Id { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("status")]
        public string? Status { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("operationId")]
        public long OperationId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("referenceId")]
        public string? ReferenceId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("reversalReferenceId")]
        public string? ReversalReferenceId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("amount")]
        public decimal Amount { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("reason")]
        public string? Reason { get; set; }
    }

    public class ZainCashV2ReverseRequest
    {
        [System.ComponentModel.DataAnnotations.Required]
        public string TransactionId { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.Required]
        public string Reason { get; set; } = string.Empty;
    }

    // Switch specific response  
    public class SwitchInitResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string? Id { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("ndc")]
        public string? Ndc { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("integrity")]
        public string? Integrity { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("result")]
        public SwitchResult? Result { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("buildNumber")]
        public string? BuildNumber { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("timestamp")]
        public string? Timestamp { get; set; }
    }
    
    public class SwitchResult
    {
        [System.Text.Json.Serialization.JsonPropertyName("code")]
        public string? Code { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("description")]
        public string? Description { get; set; }
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

    // Payment inquiry response — unified response for all gateways
    public class PaymentInquiryResponse
    {
        public Guid Uuid { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public string Gateway { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ReferenceId { get; set; }
        public string? GatewayTransactionId { get; set; }
        public string? Environment { get; set; }
        public string? ErrorMessage { get; set; }
        public string? ServiceType { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public object? RequestData { get; set; }
        public object? ResponseData { get; set; }
        public object? CallbackData { get; set; }
        public PaymentInquiryLiveData? LiveData { get; set; }
    }

    // Live data fetched from the payment gateway
    public class PaymentInquiryLiveData
    {
        public bool Success { get; set; }
        public string? GatewayStatus { get; set; }
        public object? RawResponse { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime QueriedAt { get; set; } = DateTime.UtcNow;
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
