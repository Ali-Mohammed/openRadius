using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

/// <summary>
/// Represents an API key for external programmatic access to workspace data.
/// API keys are workspace-scoped — each key grants access to a single workspace's data.
/// The raw key is shown once at creation; only the SHA-256 hash and a short prefix are stored.
/// </summary>
public class ApiKey
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();

    /// <summary>Display name chosen by the user (e.g. "CRM Integration").</summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>First 8 characters of the raw key, stored for identification (e.g. "or_abc12...").</summary>
    [Required]
    [MaxLength(12)]
    public string KeyPrefix { get; set; } = string.Empty;

    /// <summary>SHA-256 hash of the full raw key. Used for authentication lookups.</summary>
    [Required]
    [MaxLength(128)]
    public string KeyHash { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated list of granted scopes (e.g. "radius.users.read,radius.users.write").
    /// Empty / null = all scopes.
    /// </summary>
    [MaxLength(1000)]
    public string? Scopes { get; set; }

    /// <summary>Optional expiration date. Null = never expires.</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>When the key was last used to make an API call.</summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>IP address of the last request made with this key.</summary>
    [MaxLength(45)]
    public string? LastUsedIp { get; set; }

    /// <summary>Whether this key is currently active.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>The workspace this API key belongs to.</summary>
    public int WorkspaceId { get; set; }

    // ── Soft Delete ─────────────────────────────────────────────────
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeletedBy { get; set; }

    // ── Audit ───────────────────────────────────────────────────────
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? UpdatedBy { get; set; }
}
