namespace Backend.Models;

public class CashbackAmountItem
{
    public int BillingProfileId { get; set; }
    public decimal Amount { get; set; }
}

public class SaveCashbackAmountsRequest
{
    public int CashbackGroupId { get; set; }
    public List<CashbackAmountItem> Amounts { get; set; } = new();
}

public class SaveUserCashbacksRequest
{
    public int UserId { get; set; }
    public List<CashbackAmountItem> Amounts { get; set; } = new();
}
