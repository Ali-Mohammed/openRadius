using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

/// <summary>
/// Stores system-wide configuration settings as key-value pairs in the master database.
/// These are global settings that affect the entire application (not scoped to any workspace).
/// Examples: Swagger toggle, maintenance mode, feature flags.
/// </summary>
public class SystemSetting
{
    [Key]
    public int Id { get; set; }

    /// <summary>Public identifier — never expose internal int Id via APIs.</summary>
    public Guid Uuid { get; set; } = Guid.NewGuid();

    /// <summary>Unique setting key. Convention: PascalCase (e.g., "SwaggerEnabled").</summary>
    [Required]
    [MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    /// <summary>Setting value stored as string. Parsed by consumers.</summary>
    [Required]
    [MaxLength(2000)]
    public string Value { get; set; } = string.Empty;

    /// <summary>Human-readable description of what this setting controls.</summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>Category for grouping settings in the UI (e.g., "Developer", "Security", "Feature").</summary>
    [MaxLength(50)]
    public string Category { get; set; } = "General";

    /// <summary>Data type hint for the UI. Helps the frontend render the correct control.</summary>
    [MaxLength(20)]
    public string DataType { get; set; } = "boolean";

    /// <summary>Whether this setting can be changed at runtime via the API.</summary>
    public bool IsEditable { get; set; } = true;

    // ── Audit Fields ─────────────────────────────────────────────────────

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? CreatedBy { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    [JsonIgnore]
    public User? CreatedByUser { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int? UpdatedBy { get; set; }

    [ForeignKey(nameof(UpdatedBy))]
    [JsonIgnore]
    public User? UpdatedByUser { get; set; }

    // ── Soft Delete ──────────────────────────────────────────────────────

    public bool IsDeleted { get; set; } = false;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    [ForeignKey(nameof(DeletedBy))]
    [JsonIgnore]
    public User? DeletedByUser { get; set; }

    // ── Concurrency ──────────────────────────────────────────────────────

    /// <summary>Optimistic concurrency token (ETag).</summary>
    [ConcurrencyCheck]
    public uint RowVersion { get; set; }
}

/// <summary>
/// Well-known system setting keys.
/// </summary>
public static class SystemSettingKeys
{
    public const string SwaggerEnabled = "SwaggerEnabled";
}
