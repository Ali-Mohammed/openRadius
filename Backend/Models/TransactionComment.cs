namespace Backend.Models
{
    public class TransactionComment
    {
        public int Id { get; set; }
        public int TransactionId { get; set; }
        public string Comment { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }

        // Navigation property
        public Transaction? Transaction { get; set; }
    }
}
