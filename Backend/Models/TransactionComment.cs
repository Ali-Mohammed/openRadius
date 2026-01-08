namespace Backend.Models
{
    public class TransactionComment
    {
        public int Id { get; set; }
        public int TransactionId { get; set; }
        public string Comment { get; set; } = string.Empty;
        public string? Tags { get; set; } // JSON array of tags
        public string? Attachments { get; set; } // JSON array of attachment metadata
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }

        // Navigation property
        public Transaction? Transaction { get; set; }
    }

    public class CommentAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public string ContentType { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
    }
}
