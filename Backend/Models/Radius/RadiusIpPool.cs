using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

[Table("radius_ip_pools")]
public class RadiusIpPool
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();

    [Required]
    [Column("name")]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("start_ip")]
    [MaxLength(45)]
    public string StartIp { get; set; } = string.Empty;

    [Required]
    [Column("end_ip")]
    [MaxLength(45)]
    public string EndIp { get; set; } = string.Empty;

    [Required]
    [Column("lease_time")]
    public int LeaseTime { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [NotMapped]
    public bool IsDeleted => DeletedAt.HasValue;
}

public class CreateRadiusIpPoolRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string StartIp { get; set; } = string.Empty;

    [Required]
    public string EndIp { get; set; } = string.Empty;

    [Required]
    public int LeaseTime { get; set; }
}

public class UpdateRadiusIpPoolRequest
{
    public string? Name { get; set; }
    public string? StartIp { get; set; }
    public string? EndIp { get; set; }
    public int? LeaseTime { get; set; }
}
