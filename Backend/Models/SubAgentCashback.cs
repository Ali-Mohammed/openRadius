using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

/// <summary>
/// SubAgent cashback configuration - allows supervisors to set cashback amounts for their sub-agents
/// This is separate from the main cashback system and is based on supervisor-agent relationships
/// </summary>
public class SubAgentCashback
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// The supervisor (agent) who is setting the cashback for their sub-agent
    /// </summary>
    [Required]
    public int SupervisorId { get; set; }

    /// <summary>
    /// The sub-agent who will receive this cashback
    /// </summary>
    [Required]
    public int SubAgentId { get; set; }

    /// <summary>
    /// The billing profile this cashback applies to
    /// </summary>
    [Required]
    public int BillingProfileId { get; set; }

    /// <summary>
    /// Cashback amount for this billing profile
    /// </summary>
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    /// <summary>
    /// Optional notes about this cashback configuration
    /// </summary>
    public string? Notes { get; set; }

    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }

    // Navigation properties
    [ForeignKey("SupervisorId")]
    public virtual User? Supervisor { get; set; }

    [ForeignKey("SubAgentId")]
    public virtual User? SubAgent { get; set; }

    [ForeignKey("BillingProfileId")]
    public virtual BillingProfile? BillingProfile { get; set; }
}
