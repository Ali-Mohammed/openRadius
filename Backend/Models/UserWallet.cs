namespace Backend.Models;

public class UserWallet
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int CustomWalletId { get; set; }
    
    // Current balance for this user's wallet
    public decimal CurrentBalance { get; set; } = 0;
    
    // User-specific limits (can override custom wallet defaults)
    public decimal? MaxFillLimit { get; set; }
    public decimal? DailySpendingLimit { get; set; }
    
    // Status specific to this user's wallet
    public string Status { get; set; } = "active"; // active, disabled, suspended
    
    // Allow negative balance for this specific user wallet
    public bool? AllowNegativeBalance { get; set; }
    
    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    
    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    // Navigation properties
    // Note: User is not included as navigation to avoid cross-context issues
    // User data is fetched from MasterDbContext separately
    public CustomWallet CustomWallet { get; set; } = null!;
}
