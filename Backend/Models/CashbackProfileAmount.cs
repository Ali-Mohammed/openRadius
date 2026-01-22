using System;

namespace Backend.Models
{
    public class CashbackProfileAmount
    {
        public int Id { get; set; }
        public int CashbackGroupId { get; set; }
        public int BillingProfileId { get; set; }
        public decimal Amount { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }

        // Navigation properties
        public CashbackGroup? CashbackGroup { get; set; }
        public BillingProfile? BillingProfile { get; set; }
    }
}
