using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public class Dashboard
{
    [Key]
    public int Id { get; set; }

    [Required]
    [StringLength(255)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [StringLength(100)]
    public string Icon { get; set; } = "LayoutDashboard";

    [StringLength(50)]
    public string Color { get; set; } = "#3b82f6";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }

    // Navigation properties
    public virtual ICollection<DashboardTab> Tabs { get; set; } = new List<DashboardTab>();
    public virtual ICollection<DashboardGlobalFilter> GlobalFilters { get; set; } = new List<DashboardGlobalFilter>();
}

public class DashboardTab
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int DashboardId { get; set; }

    [Required]
    [StringLength(255)]
    public string Name { get; set; } = string.Empty;

    public int OrderIndex { get; set; }

    public bool IsDeleted { get; set; } = false;

    // Navigation properties
    [ForeignKey("DashboardId")]
    public virtual Dashboard Dashboard { get; set; } = null!;

    public virtual ICollection<DashboardItem> Items { get; set; } = new List<DashboardItem>();
}

public class DashboardItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int TabId { get; set; }

    [Required]
    [StringLength(50)]
    public string Type { get; set; } = string.Empty; // chart, text, metric, table

    [Required]
    [StringLength(255)]
    public string Title { get; set; } = string.Empty;

    // Layout properties
    public int LayoutX { get; set; }
    public int LayoutY { get; set; }
    public int LayoutW { get; set; }
    public int LayoutH { get; set; }

    // Config stored as JSON
    [Column(TypeName = "jsonb")]
    public string Config { get; set; } = "{}";

    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }

    // Navigation properties
    [ForeignKey("TabId")]
    public virtual DashboardTab Tab { get; set; } = null!;
}

public class DashboardGlobalFilter
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int DashboardId { get; set; }

    [Required]
    [StringLength(255)]
    public string Label { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Type { get; set; } = string.Empty; // date, select, multiselect, text

    [Column(TypeName = "jsonb")]
    public string? Value { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Options { get; set; }

    public int OrderIndex { get; set; }

    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }

    // Navigation properties
    [ForeignKey("DashboardId")]
    public virtual Dashboard Dashboard { get; set; } = null!;
}
