namespace Backend.Models;

public static class TransactionType
{
    public const string TopUp = "topup";
    public const string Withdrawal = "withdrawal";
    public const string Transfer = "transfer";
    public const string Adjustment = "adjustment";
    public const string Purchase = "purchase";
    public const string Refund = "refund";
    public const string Payment = "payment";
    public const string Reward = "reward";
    public const string Fee = "fee";
    public const string Commission = "commission";

    public static readonly string[] AllTypes = 
    {
        TopUp,
        Withdrawal,
        Transfer,
        Adjustment,
        Purchase,
        Refund,
        Payment,
        Reward,
        Fee,
        Commission
    };

    public static bool IsCredit(string transactionType)
    {
        return transactionType switch
        {
            TopUp => true,
            Refund => true,
            Reward => true,
            Adjustment => true, // Can be either, but default to credit
            _ => false
        };
    }

    public static bool IsDebit(string transactionType)
    {
        return transactionType switch
        {
            Withdrawal => true,
            Transfer => true,
            Purchase => true,
            Payment => true,
            Fee => true,
            Commission => true,
            _ => false
        };
    }

    public static string GetDisplayName(string transactionType)
    {
        return transactionType switch
        {
            TopUp => "Top Up",
            Withdrawal => "Withdrawal",
            Transfer => "Transfer",
            Adjustment => "Adjustment",
            Purchase => "Purchase",
            Refund => "Refund",
            Payment => "Payment",
            Reward => "Reward",
            Fee => "Fee",
            Commission => "Commission",
            _ => transactionType
        };
    }
}
