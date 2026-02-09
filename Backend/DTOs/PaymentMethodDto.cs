namespace Backend.DTOs
{
    public class PaymentMethodDto
    {
        public int? Id { get; set; }
        public string Type { get; set; } = string.Empty; // ZainCash, ZainCashV2, QICard, Switch
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public object Settings { get; set; } = new { };
        public int? WalletId { get; set; }
        public string? WalletName { get; set; }
    }

    public class CreatePaymentMethodDto
    {
        public string Type { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public object Settings { get; set; } = new { };
        public int? WalletId { get; set; }
    }

    public class UpdatePaymentMethodDto
    {
        public string? Name { get; set; }
        public bool? IsActive { get; set; }
        public object? Settings { get; set; }
        public int? WalletId { get; set; }
        public bool ClearWalletId { get; set; } = false;
    }
}
