using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Management
{
    /// <summary>
    /// System notification sent to users. Used for payment alerts, billing reminders,
    /// activation confirmations, admin announcements, and other system-generated messages.
    /// </summary>
    public class SystemNotification
    {
        [Key]
        public int Id { get; set; }

        public Guid Uuid { get; set; } = Guid.NewGuid();

        // === Notification Content ===

        /// <summary>
        /// Notification title (short summary)
        /// </summary>
        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Full notification message body
        /// </summary>
        [Required]
        [MaxLength(4000)]
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Notification type/category (e.g., "PaymentReceived", "ActivationComplete", 
        /// "BillingReminder", "WalletLowBalance", "SystemAlert", "AdminAnnouncement")
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = string.Empty;

        /// <summary>
        /// Severity level: "info", "success", "warning", "error"
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = "info";

        // === Target ===

        /// <summary>
        /// The user ID who should receive this notification
        /// </summary>
        public int RecipientUserId { get; set; }

        // === Status ===

        /// <summary>
        /// Whether the notification has been read by the recipient
        /// </summary>
        public bool IsRead { get; set; } = false;

        /// <summary>
        /// When the notification was read
        /// </summary>
        public DateTime? ReadAt { get; set; }

        /// <summary>
        /// Whether the notification has been dismissed/acknowledged
        /// </summary>
        public bool IsDismissed { get; set; } = false;

        /// <summary>
        /// When the notification was dismissed
        /// </summary>
        public DateTime? DismissedAt { get; set; }

        // === Action/Navigation ===

        /// <summary>
        /// Optional URL or route path the user can navigate to for more details
        /// (e.g., "/billing/wallets", "/payments/{uuid}")
        /// </summary>
        [MaxLength(500)]
        public string? ActionUrl { get; set; }

        /// <summary>
        /// Optional label for the action button (e.g., "View Payment", "Go to Wallet")
        /// </summary>
        [MaxLength(100)]
        public string? ActionLabel { get; set; }

        // === Reference ===

        /// <summary>
        /// The entity type this notification relates to (e.g., "Payment", "Wallet", "Activation")
        /// </summary>
        [MaxLength(100)]
        public string? ReferenceEntityType { get; set; }

        /// <summary>
        /// The UUID of the related entity for easy lookup
        /// </summary>
        public Guid? ReferenceEntityUuid { get; set; }

        // === Metadata ===

        /// <summary>
        /// Additional metadata in JSON format (e.g., amount, gateway, profile name)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? Metadata { get; set; }

        // === Expiry ===

        /// <summary>
        /// Optional expiration date after which the notification is no longer relevant
        /// </summary>
        public DateTime? ExpiresAt { get; set; }

        // === Audit Fields ===

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// The user or system process that created this notification (0 for system-generated)
        /// </summary>
        public int CreatedBy { get; set; }

        public DateTime? UpdatedAt { get; set; }
        public int? UpdatedBy { get; set; }

        // === Soft Delete ===
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }

        // === Navigation Properties ===
        // Note: User navigation properties are ignored in ApplicationDbContext 
        // since User table is in MasterDbContext

        [ForeignKey(nameof(RecipientUserId))]
        public User? RecipientUser { get; set; }

        [ForeignKey(nameof(CreatedBy))]
        public User? CreatedByUser { get; set; }

        [ForeignKey(nameof(UpdatedBy))]
        public User? UpdatedByUser { get; set; }

        [ForeignKey(nameof(DeletedBy))]
        public User? DeletedByUser { get; set; }
    }
}
