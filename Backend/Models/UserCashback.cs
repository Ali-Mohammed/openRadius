using System;

namespace Backend.Models
{
    public class UserCashback
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int BillingProfileId { get; set; }
        public decimal Amount { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedBy { get; set; }
        public int? UpdatedBy { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }

        // Navigation properties
        public User? User { get; set; }
        public BillingProfile? BillingProfile { get; set; }
    }
}
