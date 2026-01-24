namespace Backend.Models;

public static class TransactionStatus
{
    public const string Completed = "completed";
    public const string Pending = "pending";
    public const string Cancelled = "cancelled";
    public const string Reversed = "reversed";
    public const string Failed = "failed";
}

public static class AmountType
{
    public const string Credit = "credit";
    public const string Debit = "debit";
}

public static class WalletType
{
    public const string Custom = "custom";
    public const string User = "user";
}
