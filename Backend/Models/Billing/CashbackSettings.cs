namespace Backend.Models;

/// <summary>
/// Represents cashback configuration settings for the application
/// </summary>
public class CashbackSettings
{
    public int Id { get; set; }
    
    /// <summary>
    /// Transaction type: "Instant" or "Collected"
    /// Instant: Cashback is credited immediately
    /// Collected: Cashback must be collected by user
    /// </summary>
    public string TransactionType { get; set; } = "Instant";
    
    /// <summary>
    /// Collection schedule when TransactionType is "Collected"
    /// Options: "AnyTime", "EndOfWeek", "EndOfMonth"
    /// </summary>
    public string? CollectionSchedule { get; set; }
    
    /// <summary>
    /// Minimum amount required to collect cashback (default: 0)
    /// Only applicable when TransactionType is "Collected"
    /// </summary>
    public decimal MinimumCollectionAmount { get; set; } = 0;
    
    /// <summary>
    /// Whether approval is required to collect cashback
    /// Only applicable when TransactionType is "Collected"
    /// </summary>
    public bool RequiresApprovalToCollect { get; set; } = false;
    
    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public int? UpdatedBy { get; set; }
}
