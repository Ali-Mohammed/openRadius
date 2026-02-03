using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models
{
    public class RadiusUserHistory
    {
        public int Id { get; set; }
        public Guid Uuid { get; set; } = Guid.NewGuid();
        
        // Reference to the user
        public int RadiusUserId { get; set; }
        
        // Event details
        public string EventType { get; set; } = string.Empty; // username_change, profile_update, password_change, info_update, status_change, creation, deletion, etc.
        public string Action { get; set; } = string.Empty; // Created, Updated, Deleted, Restored
        public string? Changes { get; set; } // JSON string of changes
        public string? Description { get; set; }
        
        // Additional metadata
        public string? OldValue { get; set; } // JSON or simple value
        public string? NewValue { get; set; } // JSON or simple value
        
        // Who performed the action
        public string? PerformedBy { get; set; } // Username or email
        public int? PerformedById { get; set; } // User ID who performed the action
        
        // When it happened
        public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
        
        // Request metadata
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        
        // Navigation property
        [ForeignKey(nameof(RadiusUserId))]
        public RadiusUser? RadiusUser { get; set; }
        
        [ForeignKey(nameof(PerformedById))]
        public User? PerformedByUser { get; set; }
    }
}
