namespace Backend.Models
{
    public class TablePreference
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string? ColumnWidths { get; set; } // JSON
        public string? ColumnOrder { get; set; } // JSON
        public string? ColumnVisibility { get; set; } // JSON
        public string? SortField { get; set; }
        public string? SortDirection { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
