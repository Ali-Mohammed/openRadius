namespace Backend.Models
{
    public class RadiusTag
    {
        public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
        public required string Title { get; set; }
        public string? Description { get; set; }
        public string Status { get; set; } = "active"; // active, inactive
        public string Color { get; set; } = "#3b82f6"; // Default blue color
        public string Icon { get; set; } = "Tag"; // Lucide icon name
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        // Navigation properties
        public ICollection<RadiusUserTag> RadiusUserTags { get; set; } = new List<RadiusUserTag>();
    }

    // Junction table for many-to-many relationship
    public class RadiusUserTag
    {
        public int RadiusUserId { get; set; }
        public RadiusUser RadiusUser { get; set; } = null!;

        public int RadiusTagId { get; set; }
        public RadiusTag RadiusTag { get; set; } = null!;

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }

    public class RadiusTagResponse
    {
        public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
        public string Title { get; set; } = string.Empty;
        public string TagName => Title; // Alias for frontend compatibility
        public string? Description { get; set; }
        public string Status { get; set; } = "active";
        public string Color { get; set; } = "#3b82f6";
        public string Icon { get; set; } = "Tag";
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
