using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class CustomWallet
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal MaxFillLimit { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DailySpendingLimit { get; set; }

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "spending"; // spending, collection, credit, prepaid, reward

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "active"; // active, disabled, suspended

    [MaxLength(50)]
    public string? Color { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CurrentBalance { get; set; } = 0;

    public bool AllowNegativeBalance { get; set; } = false;

    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public int? CreatedBy { get; set; }

    public int? UpdatedBy { get; set; }

    public bool IsDeleted { get; set; } = false;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }
}
