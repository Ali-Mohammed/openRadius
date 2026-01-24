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
    public const string Cashback = "cashback";
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
        Cashback,
        Fee,
        Commission
    };

    public static string GetAmountType(string transactionType)
    {
        return transactionType switch
        {
            TopUp => "credit",
            Refund => "credit",
            Reward => "credit",
            Cashback => "credit",
            Adjustment => "credit", // Can be either, but default to credit
            Withdrawal => "debit",
            Transfer => "debit",
            Purchase => "debit",
            Payment => "debit",
            Fee => "debit",
            Commission => "debit",
            _ => "credit"
        };
    }

    public static bool IsCredit(string amountType)
    {
        return amountType == "credit";
    }

    public static bool IsDebit(string amountType)
    {
        return amountType == "debit";
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
            Cashback => "Cashback",
            Fee => "Fee",
            Commission => "Commission",
            _ => transactionType
        };
    }
}
