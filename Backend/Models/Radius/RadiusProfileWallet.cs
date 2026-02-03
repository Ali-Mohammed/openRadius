using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class RadiusProfileWallet
{
    [Key]
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();


    public int RadiusProfileId { get; set; }

    public int CustomWalletId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual RadiusProfile RadiusProfile { get; set; } = null!;
    public virtual CustomWallet CustomWallet { get; set; } = null!;
}
