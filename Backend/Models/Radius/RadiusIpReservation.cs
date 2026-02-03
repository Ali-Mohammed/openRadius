using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models
{
    public class RadiusIpReservation
    {
        public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
        public required string IpAddress { get; set; }
        public string? Description { get; set; }
        public int? RadiusUserId { get; set; }
        public RadiusUser? RadiusUser { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }
        
        // Navigation Properties
        [ForeignKey(nameof(DeletedBy))]
        public User? DeletedByUser { get; set; }
    }

    public class RadiusIpReservationResponse
    {
        public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
        public string IpAddress { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? RadiusUserId { get; set; }
        public string? Username { get; set; }
        public string? Firstname { get; set; }
        public string? Lastname { get; set; }
        public string? ProfileName { get; set; }
        public string? ZoneName { get; set; }
        public string? GroupName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }
    }
}
