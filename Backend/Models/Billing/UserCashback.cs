using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models
{
    public class UserCashback
    {
        public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
        public int UserId { get; set; }
        public int BillingProfileId { get; set; }
        public decimal Amount { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedBy { get; set; }
        public int? UpdatedBy { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }
        
        // Navigation Properties
        [ForeignKey(nameof(CreatedBy))]
        public User? CreatedByUser { get; set; }
        
        [ForeignKey(nameof(UpdatedBy))]
        public User? UpdatedByUser { get; set; }
        
        [ForeignKey(nameof(DeletedBy))]
        public User? DeletedByUser { get; set; }

        // Navigation properties
        public User? User { get; set; }
        public BillingProfile? BillingProfile { get; set; }
    }
}
