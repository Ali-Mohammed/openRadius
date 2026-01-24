namespace Backend.Models
{
    public class TransactionHistory
    {
        public int Id { get; set; }
        public int TransactionId { get; set; }
        public string Action { get; set; } = string.Empty; // Created, Updated, Deleted, Restored
        public string? Changes { get; set; } // JSON string of changes
        public string PerformedBy { get; set; } = string.Empty;
        public DateTime PerformedAt { get; set; }

        // Navigation property
        public Transaction? Transaction { get; set; }
    }
}
