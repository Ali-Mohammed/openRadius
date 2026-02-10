using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models.Management
{
    /// <summary>
    /// General-purpose audit log capturing all user activities across the system.
    /// Tracks actions on: users, payments, wallets, billing profiles, activations,
    /// transactions, RADIUS users, NAS devices, settings, and any other entity.
    /// Provides a complete audit trail for compliance, troubleshooting, and analytics.
    /// </summary>
    public class AuditLog
    {
        [Key]
        public int Id { get; set; }

        public Guid Uuid { get; set; } = Guid.NewGuid();

        // === Action Details ===

        /// <summary>
        /// The type of action performed (e.g., "Create", "Update", "Delete", "Restore",
        /// "Activate", "Deactivate", "ForceComplete", "Login", "Logout", "Export", "Import",
        /// "TopUp", "Deduct", "Transfer", "Assign", "Unassign", "StatusChange", "PasswordReset")
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Action { get; set; } = string.Empty;

        /// <summary>
        /// The entity/resource type the action was performed on (e.g., "RadiusUser", "Transaction",
        /// "Wallet", "BillingProfile", "BillingActivation", "Payment", "NasDevice", "User",
        /// "Role", "Permission", "OltDevice", "Webhook", "Automation", "Settings")
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string EntityType { get; set; } = string.Empty;

        /// <summary>
        /// The internal ID of the affected entity
        /// </summary>
        public int? EntityId { get; set; }

        /// <summary>
        /// The UUID of the affected entity (for external reference)
        /// </summary>
        public Guid? EntityUuid { get; set; }

        /// <summary>
        /// High-level category for grouping and filtering
        /// (e.g., "Billing", "Payment", "UserManagement", "Network", "System", "Authentication", "Settings")
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        // === Snapshot Data ===

        /// <summary>
        /// JSON snapshot of the entity state before the action (null for create actions)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? PreviousData { get; set; }

        /// <summary>
        /// JSON snapshot of the entity state after the action (null for delete actions)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? NewData { get; set; }

        /// <summary>
        /// JSON summary of what fields changed (for update actions)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? Changes { get; set; }

        // === Context ===

        /// <summary>
        /// Human-readable description of the action
        /// (e.g., "Created billing profile 'Premium 50Mbps'", "Activated user john_doe via QICard payment")
        /// </summary>
        [MaxLength(1000)]
        public string? Description { get; set; }

        /// <summary>
        /// Reason or justification provided by the user for the action (if applicable)
        /// </summary>
        [MaxLength(2000)]
        public string? Reason { get; set; }

        /// <summary>
        /// IP address of the user who performed the action
        /// </summary>
        [MaxLength(45)]
        public string? IpAddress { get; set; }

        /// <summary>
        /// User agent string of the client
        /// </summary>
        [MaxLength(500)]
        public string? UserAgent { get; set; }

        /// <summary>
        /// The HTTP method and endpoint that triggered the action (e.g., "POST /api/payments")
        /// </summary>
        [MaxLength(500)]
        public string? RequestPath { get; set; }

        /// <summary>
        /// Correlation ID for grouping related audit entries from a single request
        /// </summary>
        [MaxLength(100)]
        public string? CorrelationId { get; set; }

        /// <summary>
        /// Additional metadata in JSON format (e.g., amount, gateway, profile name, affected count)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? Metadata { get; set; }

        // === Outcome ===

        /// <summary>
        /// Whether the action was successful: "Success", "Failure", "PartialSuccess"
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Success";

        /// <summary>
        /// Error message if the action failed
        /// </summary>
        [MaxLength(2000)]
        public string? ErrorMessage { get; set; }

        // === Target User ===

        /// <summary>
        /// The user ID whose resource was affected (the customer/target user, if applicable)
        /// </summary>
        public int? TargetUserId { get; set; }

        // === Audit Fields ===

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// The user ID of the person who performed the action (the admin/operator).
        /// 0 for system-generated actions.
        /// </summary>
        public int CreatedBy { get; set; }

        // === Soft Delete ===
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }

        // === Navigation Properties ===
        // Note: User navigation properties are ignored in ApplicationDbContext 
        // since User table is in MasterDbContext

        [ForeignKey(nameof(CreatedBy))]
        public User? CreatedByUser { get; set; }

        [ForeignKey(nameof(DeletedBy))]
        public User? DeletedByUser { get; set; }

        [ForeignKey(nameof(TargetUserId))]
        public User? TargetUser { get; set; }
    }
}
