namespace Backend.Models
{
    public class CashbackGroup
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public bool Disabled { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }
        
        // Many-to-many relationship with users
        public ICollection<CashbackGroupUser> CashbackGroupUsers { get; set; } = new List<CashbackGroupUser>();
    }

    public class CashbackGroupUser
    {
        public int CashbackGroupId { get; set; }
        public CashbackGroup CashbackGroup { get; set; } = null!;
        
        // UserId references the master database User table (no FK constraint needed)
        public int UserId { get; set; }
        
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }

    public class CashbackGroupResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public bool Disabled { get; set; }
        public int UserCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedBy { get; set; }
    }

    public class CreateCashbackGroupRequest
    {
        public required string Name { get; set; }
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public bool Disabled { get; set; } = false;
        public List<int> UserIds { get; set; } = new();
    }

    public class UpdateCashbackGroupRequest
    {
        public string? Name { get; set; }
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public bool? Disabled { get; set; }
        public List<int>? UserIds { get; set; }
    }
}
