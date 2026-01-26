using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Payments
{
    public class PaymentLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Gateway { get; set; } = string.Empty; // ZainCash, QICard, Switch

        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? ReferenceId { get; set; } // Gateway reference ID

        [MaxLength(100)]
        public string? GatewayTransactionId { get; set; } // Payment ID from gateway (e.g., QICard paymentId)

        public int UserId { get; set; }

        public decimal Amount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "IQD";

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "pending"; // pending, processing, completed, failed, cancelled

        [Column(TypeName = "jsonb")]
        public string? RequestData { get; set; } // Initial request data

        [Column(TypeName = "jsonb")]
        public string? ResponseData { get; set; } // Gateway response

        [Column(TypeName = "jsonb")]
        public string? CallbackData { get; set; } // Callback data from gateway

        [MaxLength(500)]
        public string? ErrorMessage { get; set; }

        [MaxLength(100)]
        public string? ServiceType { get; set; } // wallet_topup, subscription, etc.

        [MaxLength(20)]
        public string? Environment { get; set; } // Production, Test

        public int? WalletTransactionId { get; set; } // Link to wallet transaction

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }

        // Navigation properties
        [ForeignKey(nameof(UserId))]
        public User? User { get; set; }
    }
}
