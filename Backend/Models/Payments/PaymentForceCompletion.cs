using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Payments
{
    /// <summary>
    /// Audit record for when an admin force-completes a payment that failed/stuck but was actually paid.
    /// Contains full audit trail: who, when, justification, and uploaded proof document.
    /// </summary>
    public class PaymentForceCompletion
    {
        [Key]
        public int Id { get; set; }

        public Guid Uuid { get; set; } = Guid.NewGuid();

        /// <summary>
        /// FK to the PaymentLog that was force-completed
        /// </summary>
        public int PaymentLogId { get; set; }

        /// <summary>
        /// The original status before force completion (e.g., "failed", "pending")
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string PreviousStatus { get; set; } = string.Empty;

        /// <summary>
        /// The admin's justification for force-completing this payment
        /// </summary>
        [Required]
        [MaxLength(2000)]
        public string Justification { get; set; } = string.Empty;

        /// <summary>
        /// File path to the uploaded proof document (receipt, screenshot, etc.)
        /// </summary>
        [Required]
        [MaxLength(500)]
        public string DocumentPath { get; set; } = string.Empty;

        /// <summary>
        /// Original file name of the uploaded document
        /// </summary>
        [Required]
        [MaxLength(255)]
        public string DocumentFileName { get; set; } = string.Empty;

        /// <summary>
        /// MIME type of the uploaded document
        /// </summary>
        [MaxLength(100)]
        public string? DocumentContentType { get; set; }

        /// <summary>
        /// File size in bytes
        /// </summary>
        public long DocumentFileSize { get; set; }

        /// <summary>
        /// The amount that was credited to the wallet
        /// </summary>
        public decimal AmountCredited { get; set; }

        /// <summary>
        /// The gateway of the payment
        /// </summary>
        [MaxLength(50)]
        public string Gateway { get; set; } = string.Empty;

        /// <summary>
        /// The transaction ID from the payment log
        /// </summary>
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;

        /// <summary>
        /// IP address of the admin who performed the action
        /// </summary>
        [MaxLength(45)]
        public string? IpAddress { get; set; }

        // === Audit Fields ===
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// The user ID of the admin who force-completed the payment
        /// </summary>
        public int CreatedBy { get; set; }

        // === Navigation Properties ===
        [ForeignKey(nameof(PaymentLogId))]
        public PaymentLog? PaymentLog { get; set; }

        [ForeignKey(nameof(CreatedBy))]
        public User? CreatedByUser { get; set; }
    }
}
