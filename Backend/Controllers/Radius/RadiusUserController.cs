using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using System.Text;
using OfficeOpenXml;

namespace Backend.Controllers;

[ApiController]
[Route("api/radius/users")]
[Authorize]
public class RadiusUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusUserController> _logger;

    public RadiusUserController(ApplicationDbContext context, ILogger<RadiusUserController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // Helper method to calculate remaining days based on expiration date
    private static int CalculateRemainingDays(DateTime? expiration)
    {
        if (expiration == null) return 0;
        var days = (expiration.Value.Date - DateTime.UtcNow.Date).Days;
        return days < 0 ? 0 : days;
    }

    // Filter condition model for advanced filtering
    public class FilterCondition
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string? Id { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("field")]
        public string? Field { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("column")]
        public string? Column { get; set; }  // Support both "field" and "column" from frontend
        
        [System.Text.Json.Serialization.JsonPropertyName("operator")]
        public string? Operator { get; set; }
        
        // Value can be a single value (string) or an array of values
        [System.Text.Json.Serialization.JsonConverter(typeof(ValueConverter))]
        [System.Text.Json.Serialization.JsonPropertyName("value")]
        public object? Value { get; set; }
        
        // Second value for between operator
        [System.Text.Json.Serialization.JsonPropertyName("value2")]
        public string? Value2 { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("values")]
        public List<string>? Values { get; set; }
        
        // Helper to get the field name (supports both "field" and "column" properties)
        public string? GetFieldName() => !string.IsNullOrEmpty(Field) ? Field : Column;
        
        // Helper to get value as string
        public string? GetValueString() => Value?.ToString();
        
        // Helper to get value as list of strings (for in/not_in operators)
        public List<string>? GetValueList()
        {
            if (Values != null && Values.Count > 0) return Values;
            if (Value is List<string> stringList)
            {
                return stringList;
            }
            if (Value is System.Text.Json.JsonElement element && element.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                return element.EnumerateArray().Select(e => e.ToString()).ToList();
            }
            if (Value is List<object> objList)
            {
                return objList.Select(o => o?.ToString() ?? "").ToList();
            }
            return null;
        }
    }
    
    // Custom JSON converter to handle value being either string or array
    public class ValueConverter : System.Text.Json.Serialization.JsonConverter<object?>
    {
        public override object? Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
        {
            if (reader.TokenType == System.Text.Json.JsonTokenType.Null)
                return null;
            if (reader.TokenType == System.Text.Json.JsonTokenType.String)
                return reader.GetString();
            if (reader.TokenType == System.Text.Json.JsonTokenType.Number)
                return reader.GetDecimal().ToString();
            if (reader.TokenType == System.Text.Json.JsonTokenType.True || reader.TokenType == System.Text.Json.JsonTokenType.False)
                return reader.GetBoolean().ToString();
            if (reader.TokenType == System.Text.Json.JsonTokenType.StartArray)
            {
                var list = new List<string>();
                while (reader.Read() && reader.TokenType != System.Text.Json.JsonTokenType.EndArray)
                {
                    // Handle different types in the array (string, number, etc.)
                    if (reader.TokenType == System.Text.Json.JsonTokenType.String)
                        list.Add(reader.GetString() ?? "");
                    else if (reader.TokenType == System.Text.Json.JsonTokenType.Number)
                        list.Add(reader.GetDecimal().ToString());
                    else if (reader.TokenType == System.Text.Json.JsonTokenType.True || reader.TokenType == System.Text.Json.JsonTokenType.False)
                        list.Add(reader.GetBoolean().ToString());
                    else if (reader.TokenType == System.Text.Json.JsonTokenType.Null)
                        list.Add("");
                }
                return list;
            }
            // Return as JsonElement for complex types
            return System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(ref reader, options);
        }
        
        public override void Write(System.Text.Json.Utf8JsonWriter writer, object? value, System.Text.Json.JsonSerializerOptions options)
        {
            System.Text.Json.JsonSerializer.Serialize(writer, value, options);
        }
    }

    public class FilterGroup
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string? Id { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("logic")]
        public string Logic { get; set; } = "and";
        
        [System.Text.Json.Serialization.JsonPropertyName("conditions")]
        public List<object>? Conditions { get; set; }
    }

    // Apply advanced filters to query
    private IQueryable<RadiusUser> ApplyAdvancedFilters(IQueryable<RadiusUser> query, FilterGroup? filterGroup)
    {
        _logger.LogInformation("🚀 ApplyAdvancedFilters called - filterGroup is null: {IsNull}", filterGroup == null);
        
        if (filterGroup == null || filterGroup.Conditions == null || filterGroup.Conditions.Count == 0)
        {
            _logger.LogWarning("⚠️ Returning early - filterGroup null: {FgNull}, Conditions null: {CondNull}, Conditions count: {Count}", 
                filterGroup == null, filterGroup?.Conditions == null, filterGroup?.Conditions?.Count ?? 0);
            return query;
        }

        _logger.LogInformation("📦 Processing {Count} conditions", filterGroup.Conditions.Count);

        var conditions = new List<System.Linq.Expressions.Expression<Func<RadiusUser, bool>>>();

        foreach (var item in filterGroup.Conditions)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(item);
            
            _logger.LogInformation("📄 Condition JSON: {Json}", json);
            
            // Try to parse as FilterCondition first (support both "field" and "column" from frontend)
            if (json.Contains("\"field\"") || json.Contains("\"column\""))
            {
                var condition = System.Text.Json.JsonSerializer.Deserialize<FilterCondition>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                
                _logger.LogInformation("✅ Deserialized condition: Field={Field}, Column={Column}, Operator={Op}, Value type={ValueType}", 
                    condition?.Field, condition?.Column, condition?.Operator, condition?.Value?.GetType().Name);
                
                if (condition != null && !string.IsNullOrEmpty(condition.GetFieldName()))
                {
                    var predicate = BuildConditionPredicate(condition);
                    if (predicate != null)
                    {
                        conditions.Add(predicate);
                        _logger.LogInformation("✨ Added predicate for field: {Field}", condition.GetFieldName());
                    }
                    else
                    {
                        _logger.LogWarning("⚠️ BuildConditionPredicate returned null for field: {Field}", condition.GetFieldName());
                    }
                }
                else
                {
                    _logger.LogWarning("⚠️ Condition is null or has empty field name");
                }
            }
            // Otherwise it's a nested group
            else if (json.Contains("\"conditions\""))
            {
                var nestedGroup = System.Text.Json.JsonSerializer.Deserialize<FilterGroup>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                // For nested groups, we'd need to recursively build - for simplicity, flatten for now
            }
        }

        _logger.LogInformation("🎲 Total predicates to apply: {Count}", conditions.Count);

        if (conditions.Count == 0)
            return query;

        // Apply conditions based on logic (AND/OR)
        if (filterGroup.Logic?.ToLower() == "or")
        {
            // OR logic - combine predicates
            var parameter = System.Linq.Expressions.Expression.Parameter(typeof(RadiusUser), "u");
            System.Linq.Expressions.Expression? combined = null;

            foreach (var cond in conditions)
            {
                var body = System.Linq.Expressions.Expression.Invoke(cond, parameter);
                combined = combined == null ? body : System.Linq.Expressions.Expression.OrElse(combined, body);
            }

            if (combined != null)
            {
                var lambda = System.Linq.Expressions.Expression.Lambda<Func<RadiusUser, bool>>(combined, parameter);
                query = query.Where(lambda);
            }
        }
        else
        {
            // AND logic - chain Where clauses
            foreach (var cond in conditions)
            {
                query = query.Where(cond);
            }
        }

        return query;
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildConditionPredicate(FilterCondition condition)
    {
        var field = condition.GetFieldName()?.ToLower();
        var op = condition.Operator?.ToLower();
        var value = condition.GetValueString();
        var values = condition.GetValueList();

        _logger.LogInformation("🔧 BuildConditionPredicate: field={Field}, op={Op}, value={Value}, values count={Count}", 
            field, op, value, values?.Count ?? 0);

        var predicate = field switch
        {
            "username" => BuildStringPredicate(u => u.Username, op, value, values),
            "firstname" => BuildStringPredicate(u => u.Firstname, op, value, values),
            "lastname" => BuildStringPredicate(u => u.Lastname, op, value, values),
            "email" => BuildStringPredicate(u => u.Email, op, value, values),
            "phonenumber" or "phone" => BuildStringPredicate(u => u.Phone, op, value, values),
            "city" => BuildStringPredicate(u => u.City, op, value, values),
            "address" => BuildStringPredicate(u => u.Address, op, value, values),
            "company" => BuildStringPredicate(u => u.Company, op, value, values),
            "notes" => BuildStringPredicate(u => u.Notes, op, value, values),
            "radiusprofileid" or "profileid" => BuildIntPredicate(u => u.ProfileId, op, value, values),
            "radiusgroupid" or "groupid" => BuildIntPredicate(u => u.GroupId, op, value, values),
            "zoneid" => BuildIntPredicate(u => u.ZoneId, op, value, values),
            "isactive" or "enabled" => BuildBoolPredicate(u => u.Enabled, op),
            "balance" => BuildDecimalPredicate(u => u.Balance, op, value, condition.Value2),
            "loanbalance" => BuildDecimalPredicate(u => u.LoanBalance, op, value, condition.Value2),
            "expirationdate" or "expiration" => BuildDatePredicate(u => u.Expiration, op, value, condition.Value2),
            "createdat" => BuildDatePredicate(u => u.CreatedAt, op, value, condition.Value2),
            "updatedat" => BuildDatePredicate(u => u.UpdatedAt, op, value, condition.Value2),
            "lastonline" => BuildDatePredicate(u => u.LastOnline, op, value, condition.Value2),
            "tags" => BuildTagsPredicate(op, values),
            _ => null
        };
        
        _logger.LogInformation("🎯 BuildConditionPredicate result: field={Field}, predicate is null: {IsNull}", 
            field, predicate == null);
        return predicate;
    }

    private static System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildStringPredicate(
        System.Linq.Expressions.Expression<Func<RadiusUser, string?>> selector, string? op, string? value, List<string>? values)
    {
        if (string.IsNullOrEmpty(op)) return null;
        var propName = GetPropertyName(selector);

        return op switch
        {
            // For equals: if multiple values provided, treat as "in" (any match), otherwise single comparison
            "equals" => values != null && values.Count > 0
                ? (u => EF.Property<string>(u, propName) != null && values.Contains(EF.Property<string>(u, propName)!))
                : (u => EF.Property<string>(u, propName) == value),
            // For not_equals: if multiple values provided, treat as "not in", otherwise single comparison
            "not_equals" => values != null && values.Count > 0
                ? (u => EF.Property<string>(u, propName) == null || !values.Contains(EF.Property<string>(u, propName)!))
                : (u => EF.Property<string>(u, propName) != value),
            "in" or "is_any_of" => values != null && values.Count > 0
                ? (u => EF.Property<string>(u, propName) != null && values.Contains(EF.Property<string>(u, propName)!))
                : null,
            "not_in" or "is_none_of" => values != null && values.Count > 0
                ? (u => EF.Property<string>(u, propName) == null || !values.Contains(EF.Property<string>(u, propName)!))
                : null,
            "contains" => u => EF.Property<string>(u, propName) != null && EF.Property<string>(u, propName)!.ToLower().Contains((value ?? "").ToLower()),
            "not_contains" => u => EF.Property<string>(u, propName) == null || !EF.Property<string>(u, propName)!.ToLower().Contains((value ?? "").ToLower()),
            "starts_with" => u => EF.Property<string>(u, propName) != null && EF.Property<string>(u, propName)!.ToLower().StartsWith((value ?? "").ToLower()),
            "ends_with" => u => EF.Property<string>(u, propName) != null && EF.Property<string>(u, propName)!.ToLower().EndsWith((value ?? "").ToLower()),
            "is_empty" => u => string.IsNullOrEmpty(EF.Property<string>(u, propName)),
            "is_not_empty" => u => !string.IsNullOrEmpty(EF.Property<string>(u, propName)),
            _ => null
        };
    }

    private static string GetPropertyName<T>(System.Linq.Expressions.Expression<Func<RadiusUser, T>> selector)
    {
        if (selector.Body is System.Linq.Expressions.MemberExpression member)
            return member.Member.Name;
        throw new ArgumentException("Invalid selector");
    }

    private static System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildIntPredicate(
        System.Linq.Expressions.Expression<Func<RadiusUser, int?>> selector, string? op, string? value, List<string>? values)
    {
        if (string.IsNullOrEmpty(op)) return null;
        var propName = GetPropertyName(selector);

        // Parse single value
        int? intValue = null;
        if (!string.IsNullOrEmpty(value) && int.TryParse(value, out var parsed))
            intValue = parsed;

        // Parse multiple values for in/not_in and multi-select equals/not_equals
        var intValues = values?.Where(v => int.TryParse(v, out _)).Select(v => int.Parse(v)).ToList() ?? new List<int>();

        return op switch
        {
            // For equals: if multiple values provided, treat as "in", otherwise single comparison
            "equals" or "is" => intValues.Count > 0 
                ? (u => EF.Property<int?>(u, propName) != null && intValues.Contains(EF.Property<int?>(u, propName)!.Value))
                : (u => EF.Property<int?>(u, propName) == intValue),
            // For not_equals: if multiple values provided, treat as "not in", otherwise single comparison
            "not_equals" or "is_not" => intValues.Count > 0
                ? (u => EF.Property<int?>(u, propName) == null || !intValues.Contains(EF.Property<int?>(u, propName)!.Value))
                : (u => EF.Property<int?>(u, propName) != intValue),
            "is_any_of" or "in" => u => EF.Property<int?>(u, propName) != null && intValues.Contains(EF.Property<int?>(u, propName)!.Value),
            "is_none_of" or "not_in" => u => EF.Property<int?>(u, propName) == null || !intValues.Contains(EF.Property<int?>(u, propName)!.Value),
            "is_empty" => u => EF.Property<int?>(u, propName) == null,
            "is_not_empty" => u => EF.Property<int?>(u, propName) != null,
            _ => null
        };
    }

    private static System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildDecimalPredicate(
        System.Linq.Expressions.Expression<Func<RadiusUser, decimal?>> selector, string? op, string? value, string? value2 = null)
    {
        if (string.IsNullOrEmpty(op)) return null;
        var propName = GetPropertyName(selector);

        decimal? decValue = null;
        if (!string.IsNullOrEmpty(value) && decimal.TryParse(value, out var parsed))
            decValue = parsed;

        decimal? decValue2 = null;
        if (!string.IsNullOrEmpty(value2) && decimal.TryParse(value2, out var parsed2))
            decValue2 = parsed2;

        return op switch
        {
            "between" => decValue != null && decValue2 != null 
                ? u => EF.Property<decimal?>(u, propName) != null && 
                       EF.Property<decimal?>(u, propName) >= decValue && 
                       EF.Property<decimal?>(u, propName) <= decValue2
                : null,
            "equals" => u => EF.Property<decimal?>(u, propName) == decValue,
            "not_equals" => u => EF.Property<decimal?>(u, propName) != decValue,
            "greater_than" => u => EF.Property<decimal?>(u, propName) > decValue,
            "less_than" => u => EF.Property<decimal?>(u, propName) < decValue,
            "greater_equal" => u => EF.Property<decimal?>(u, propName) >= decValue,
            "less_equal" => u => EF.Property<decimal?>(u, propName) <= decValue,
            "is_empty" => u => EF.Property<decimal?>(u, propName) == null,
            "is_not_empty" => u => EF.Property<decimal?>(u, propName) != null,
            _ => null
        };
    }

    private static System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildBoolPredicate(
        System.Linq.Expressions.Expression<Func<RadiusUser, bool?>> selector, string? op)
    {
        if (string.IsNullOrEmpty(op)) return null;
        var propName = GetPropertyName(selector);

        return op switch
        {
            "is_true" => u => EF.Property<bool?>(u, propName) == true,
            "is_false" => u => EF.Property<bool?>(u, propName) == false || EF.Property<bool?>(u, propName) == null,
            _ => null
        };
    }

    private static DateTime? ParseRelativeDate(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;

        // Try parsing as absolute date first
        if (DateTime.TryParse(value, out var parsed))
            return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);

        // Parse relative date keywords
        var now = DateTime.UtcNow;
        return value.ToLowerInvariant() switch
        {
            "now" => now,
            "today" => now.Date,
            "yesterday" => now.Date.AddDays(-1),
            "tomorrow" => now.Date.AddDays(1),
            "7_days_ago" => now.AddDays(-7),
            "30_days_ago" => now.AddDays(-30),
            "90_days_ago" => now.AddDays(-90),
            "1_year_ago" => now.AddYears(-1),
            "7_days_from_now" => now.AddDays(7),
            "30_days_from_now" => now.AddDays(30),
            "90_days_from_now" => now.AddDays(90),
            "1_year_from_now" => now.AddYears(1),
            "start_of_month" => new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            "end_of_month" => new DateTime(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month), 23, 59, 59, DateTimeKind.Utc),
            "start_of_year" => new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            "end_of_year" => new DateTime(now.Year, 12, 31, 23, 59, 59, DateTimeKind.Utc),
            _ => null
        };
    }

    private static System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildDatePredicate(
        System.Linq.Expressions.Expression<Func<RadiusUser, DateTime?>> selector, string? op, string? value, string? value2 = null)
    {
        if (string.IsNullOrEmpty(op)) return null;
        var propName = GetPropertyName(selector);

        DateTime? dateValue = ParseRelativeDate(value);
        DateTime? dateValue2 = ParseRelativeDate(value2);

        var now = DateTime.UtcNow;

        return op switch
        {
            "between" => dateValue != null && dateValue2 != null 
                ? u => EF.Property<DateTime?>(u, propName) != null && 
                       EF.Property<DateTime?>(u, propName)!.Value.Date >= dateValue.Value.Date && 
                       EF.Property<DateTime?>(u, propName)!.Value.Date <= dateValue2.Value.Date
                : null,
            "equals" or "is" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName)!.Value.Date == (dateValue ?? now).Date,
            "not_equals" or "is_not" => u => EF.Property<DateTime?>(u, propName) == null || EF.Property<DateTime?>(u, propName)!.Value.Date != (dateValue ?? now).Date,
            "before" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) < dateValue,
            "after" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) > dateValue,
            "on_or_before" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) <= dateValue,
            "on_or_after" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) >= dateValue,
            "is_empty" => u => EF.Property<DateTime?>(u, propName) == null,
            "is_not_empty" => u => EF.Property<DateTime?>(u, propName) != null,
            "within_last_week" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) >= now.AddDays(-7),
            "within_last_month" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) >= now.AddMonths(-1),
            "within_last_year" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) >= now.AddYears(-1),
            "is_today" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName)!.Value.Date == now.Date,
            "is_tomorrow" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName)!.Value.Date == now.AddDays(1).Date,
            "is_yesterday" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName)!.Value.Date == now.AddDays(-1).Date,
            "is_this_week" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName) >= now.AddDays(-(int)now.DayOfWeek) && EF.Property<DateTime?>(u, propName) < now.AddDays(7 - (int)now.DayOfWeek),
            "is_this_month" => u => EF.Property<DateTime?>(u, propName) != null && EF.Property<DateTime?>(u, propName)!.Value.Year == now.Year && EF.Property<DateTime?>(u, propName)!.Value.Month == now.Month,
            _ => null
        };
    }

    private System.Linq.Expressions.Expression<Func<RadiusUser, bool>>? BuildTagsPredicate(string? op, List<string>? values)
    {
        if (string.IsNullOrEmpty(op)) return null;

        var tagIds = values?.Where(v => int.TryParse(v, out _)).Select(v => int.Parse(v)).ToList() ?? new List<int>();

        return op switch
        {
            "contains" or "contains_any" or "is_any_of" => u => u.RadiusUserTags.Any(t => tagIds.Contains(t.RadiusTagId)),
            "contains_all" => u => tagIds.All(tagId => u.RadiusUserTags.Any(t => t.RadiusTagId == tagId)),
            "does_not_contain" or "not_contains" => u => !u.RadiusUserTags.Any(t => tagIds.Contains(t.RadiusTagId)),
            "is_empty" => u => !u.RadiusUserTags.Any(),
            "is_not_empty" => u => u.RadiusUserTags.Any(),
            _ => null
        };
    }

    // GET: api/radius/users
    [HttpGet]
    public async Task<ActionResult<object>> GetUsers(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false,
        [FromQuery] string? filters = null)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Include(u => u.RadiusGroup)
            .Include(u => u.Zone)
            .Include(u => u.RadiusUserTags)
                .ThenInclude(ut => ut.RadiusTag)
            .Where(u => includeDeleted || !u.IsDeleted);

        // Zone-based filtering for non-admin users
        var systemUserId = User.GetSystemUserId();
        var userKeycloakId = User.GetUserKeycloakId();
        
        // Check admin role using helper
        var isAdmin = User.IsAdmin();

        Console.WriteLine("-------------------");
        Console.WriteLine("Checking if user is =>" + isAdmin);
        Console.WriteLine("-------------------");
        
        var isImpersonating = User.IsImpersonating();
        
        // Log all roles for debugging
        var allRoles = User.Claims
            .Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role)
            .Select(c => c.Value)
            .ToList();
        
        _logger.LogInformation("🔍 ZONE FILTER DEBUG - SystemUserId: {SystemUserId}, UserKeycloakId: {UserId}, IsAdmin: {IsAdmin}, IsImpersonating: {IsImpersonating}, Roles: [{Roles}]", 
            systemUserId, userKeycloakId, isAdmin, isImpersonating, string.Join(", ", allRoles));
        
        // Get total count before any filtering
        var totalBeforeFilter = await _context.RadiusUsers.CountAsync();
        var totalActiveBeforeFilter = await _context.RadiusUsers.Where(u => includeDeleted || !u.IsDeleted).CountAsync();
        _logger.LogInformation("📊 RADIUS USERS COUNT - Total in DB: {Total}, Active: {Active}, IncludeDeleted: {IncludeDeleted}", 
            totalBeforeFilter, totalActiveBeforeFilter, includeDeleted);
        
        
        if (!isAdmin && systemUserId.HasValue)
        {
            // Get zones managed by this user
            var userZoneIds = await _context.UserZones
                .Where(uz => uz.UserId == systemUserId.Value)
                .Select(uz => uz.ZoneId)
                .ToListAsync();
            
            _logger.LogInformation("🔍 ZONE FILTER DEBUG - Found {Count} zones for user: [{Zones}]", 
                userZoneIds.Count, string.Join(", ", userZoneIds));
            
            if (userZoneIds.Any())
            {
                // Filter RADIUS users to only show users in managed zones
                query = query.Where(u => u.ZoneId.HasValue && userZoneIds.Contains(u.ZoneId.Value));
                _logger.LogInformation("✅ ZONE FILTER APPLIED - Showing only zones: [{Zones}]", string.Join(", ", userZoneIds));
            }
            else
            {
                // User has no zones assigned, show no RADIUS users
                query = query.Where(u => false);
                _logger.LogWarning("⚠️ ZONE FILTER - No zones found, showing NO users");
            }
        }
        else
        {
            _logger.LogInformation("ℹ️ ZONE FILTER SKIPPED - IsAdmin: {IsAdmin}, HasKeycloakId: {HasId}", 
                isAdmin, !string.IsNullOrEmpty(userKeycloakId));
        }

        // Apply advanced filters
        if (!string.IsNullOrEmpty(filters))
        {
            try
            {
                var filterGroup = System.Text.Json.JsonSerializer.Deserialize<FilterGroup>(filters, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                query = ApplyAdvancedFilters(query, filterGroup);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to parse filters: {Error}", ex.Message);
            }
        }

        // Get IP reservations for users
        var ipReservations = await _context.RadiusIpReservations
            .Where(r => r.DeletedAt == null)
            .ToListAsync();
        var userIpMap = ipReservations
            .Where(r => r.RadiusUserId.HasValue)
            .GroupBy(r => r.RadiusUserId!.Value)
            .ToDictionary(g => g.Key, g => g.First().IpAddress);

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => 
                (u.Username != null && u.Username.ToLower().Contains(searchLower)) ||
                (u.Firstname != null && u.Firstname.ToLower().Contains(searchLower)) ||
                (u.Lastname != null && u.Lastname.ToLower().Contains(searchLower)) ||
                (u.Email != null && u.Email.ToLower().Contains(searchLower)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "username" => isDescending ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
                "name" => isDescending ? query.OrderByDescending(u => u.Firstname).ThenByDescending(u => u.Lastname) : query.OrderBy(u => u.Firstname).ThenBy(u => u.Lastname),
                "email" => isDescending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
                "phone" => isDescending ? query.OrderByDescending(u => u.Phone) : query.OrderBy(u => u.Phone),
                "city" => isDescending ? query.OrderByDescending(u => u.City) : query.OrderBy(u => u.City),
                "profile" => isDescending ? query.OrderByDescending(u => u.Profile!.Name) : query.OrderBy(u => u.Profile!.Name),
                "enabled" => isDescending ? query.OrderByDescending(u => u.Enabled) : query.OrderBy(u => u.Enabled),
                "balance" => isDescending ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
                "loanbalance" => isDescending ? query.OrderByDescending(u => u.LoanBalance) : query.OrderBy(u => u.LoanBalance),
                "expiration" => isDescending ? query.OrderByDescending(u => u.Expiration) : query.OrderBy(u => u.Expiration),
                "lastonline" => isDescending ? query.OrderByDescending(u => u.LastOnline) : query.OrderBy(u => u.LastOnline),
                "onlinestatus" => isDescending ? query.OrderByDescending(u => u.OnlineStatus) : query.OrderBy(u => u.OnlineStatus),
                "remainingdays" => isDescending ? query.OrderByDescending(u => u.RemainingDays) : query.OrderBy(u => u.RemainingDays),
                "debtdays" => isDescending ? query.OrderByDescending(u => u.DebtDays) : query.OrderBy(u => u.DebtDays),
                "staticip" => isDescending ? query.OrderByDescending(u => u.StaticIp) : query.OrderBy(u => u.StaticIp),
                "company" => isDescending ? query.OrderByDescending(u => u.Company) : query.OrderBy(u => u.Company),
                "address" => isDescending ? query.OrderByDescending(u => u.Address) : query.OrderBy(u => u.Address),
                "contractid" => isDescending ? query.OrderByDescending(u => u.ContractId) : query.OrderBy(u => u.ContractId),
                "notes" => isDescending ? query.OrderByDescending(u => u.Notes) : query.OrderBy(u => u.Notes),
                "deviceserialnumber" => isDescending ? query.OrderByDescending(u => u.DeviceSerialNumber) : query.OrderBy(u => u.DeviceSerialNumber),
                "gpslat" => isDescending ? query.OrderByDescending(u => u.GpsLat) : query.OrderBy(u => u.GpsLat),
                "gpslng" => isDescending ? query.OrderByDescending(u => u.GpsLng) : query.OrderBy(u => u.GpsLng),
                "simultaneoussessions" => isDescending ? query.OrderByDescending(u => u.SimultaneousSessions) : query.OrderBy(u => u.SimultaneousSessions),
                "createdat" => isDescending ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
                "updatedat" => isDescending ? query.OrderByDescending(u => u.UpdatedAt) : query.OrderBy(u => u.UpdatedAt),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(u => u.CreatedAt);
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = users.Select(u => new RadiusUserResponse
        {
            Id = u.Id,
            Uuid = u.Uuid,
            ExternalId = u.ExternalId,
            Username = u.Username,
            Firstname = u.Firstname,
            Lastname = u.Lastname,
            City = u.City,
            Phone = u.Phone,
            Email = u.Email,
            ProfileId = u.ProfileId,
            ProfileName = u.Profile?.Name,
            Balance = u.Balance,
            LoanBalance = u.LoanBalance,
            Expiration = u.Expiration,
            LastOnline = u.LastOnline,
            Enabled = u.Enabled,
            OnlineStatus = u.OnlineStatus,
            RemainingDays = CalculateRemainingDays(u.Expiration),
            DebtDays = u.DebtDays,
            StaticIp = userIpMap.ContainsKey(u.Id) ? userIpMap[u.Id] : null,
            Company = u.Company,
            Address = u.Address,
            ContractId = u.ContractId,
            Notes = u.Notes,
            DeviceSerialNumber = u.DeviceSerialNumber,
            GpsLat = u.GpsLat,
            GpsLng = u.GpsLng,
            SimultaneousSessions = u.SimultaneousSessions,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            LastSyncedAt = u.LastSyncedAt,
            DeletedAt = u.DeletedAt,
            DeletedBy = u.DeletedBy,
            ZoneId = u.ZoneId,
            ZoneName = u.Zone != null ? u.Zone.Name : null,
            ZoneColor = u.Zone != null ? u.Zone.Color : null,
            GroupId = u.GroupId,
            GroupName = u.RadiusGroup != null ? u.RadiusGroup.Name : null,
            Tags = u.RadiusUserTags.Select(ut => new RadiusTagResponse
            {
                Id = ut.RadiusTag.Id,
                Title = ut.RadiusTag.Title,
                Description = ut.RadiusTag.Description,
                Status = ut.RadiusTag.Status,
                Color = ut.RadiusTag.Color,
                Icon = ut.RadiusTag.Icon,
                CreatedAt = ut.RadiusTag.CreatedAt,
                UpdatedAt = ut.RadiusTag.UpdatedAt
            }).ToList()
        });

        return Ok(new
        {
            data = response,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    // GET: api/radius/users/suggestions
    // Returns unique values for a field to use in filter suggestions
    [HttpGet("suggestions")]
    public async Task<ActionResult<object>> GetFieldSuggestions(
        [FromQuery] string field,
        [FromQuery] string? search = null,
        [FromQuery] int limit = 20)
    {
        if (string.IsNullOrEmpty(field))
            return BadRequest(new { message = "Field parameter is required" });

        var query = _context.RadiusUsers.Where(u => !u.IsDeleted);
        var searchLower = search?.ToLower() ?? "";

        object suggestions = field.ToLower() switch
        {
            "username" => await query
                .Where(u => u.Username != null && (string.IsNullOrEmpty(searchLower) || u.Username.ToLower().Contains(searchLower)))
                .Select(u => u.Username)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "firstname" => await query
                .Where(u => u.Firstname != null && (string.IsNullOrEmpty(searchLower) || u.Firstname.ToLower().Contains(searchLower)))
                .Select(u => u.Firstname)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "lastname" => await query
                .Where(u => u.Lastname != null && (string.IsNullOrEmpty(searchLower) || u.Lastname.ToLower().Contains(searchLower)))
                .Select(u => u.Lastname)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "email" => await query
                .Where(u => u.Email != null && (string.IsNullOrEmpty(searchLower) || u.Email.ToLower().Contains(searchLower)))
                .Select(u => u.Email)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "phonenumber" or "phone" => await query
                .Where(u => u.Phone != null && (string.IsNullOrEmpty(searchLower) || u.Phone.ToLower().Contains(searchLower)))
                .Select(u => u.Phone)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "city" => await query
                .Where(u => u.City != null && (string.IsNullOrEmpty(searchLower) || u.City.ToLower().Contains(searchLower)))
                .Select(u => u.City)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "address" => await query
                .Where(u => u.Address != null && (string.IsNullOrEmpty(searchLower) || u.Address.ToLower().Contains(searchLower)))
                .Select(u => u.Address)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "company" => await query
                .Where(u => u.Company != null && (string.IsNullOrEmpty(searchLower) || u.Company.ToLower().Contains(searchLower)))
                .Select(u => u.Company)
                .Distinct()
                .Take(limit)
                .ToListAsync(),
            "radiusprofileid" or "profileid" => await _context.RadiusProfiles
                .Where(p => !p.IsDeleted)
                .Select(p => new { value = p.Id.ToString(), label = p.Name })
                .ToListAsync(),
            "radiusgroupid" or "groupid" => await _context.RadiusGroups
                .Where(g => !g.IsDeleted)
                .Select(g => new { value = g.Id.ToString(), label = g.Name })
                .ToListAsync(),
            "zoneid" => await _context.Zones
                .Where(z => z.DeletedAt == null)
                .Select(z => new { value = z.Id.ToString(), label = z.Name })
                .ToListAsync(),
            "tags" => await _context.RadiusTags
                .Where(t => t.DeletedAt == null)
                .Select(t => new { value = t.Id.ToString(), label = t.Title, color = t.Color, icon = t.Icon })
                .ToListAsync(),
            "balance" => await query
                .Select(u => u.Balance)
                .Distinct()
                .OrderBy(b => b)
                .Take(limit)
                .Select(b => b.ToString())
                .ToListAsync(),
            _ => new List<string>()
        };

        return Ok(new { field, suggestions });
    }

    // GET: api/radius/users/uuid/{uuid}
    [HttpGet("uuid/{uuid:guid}")]
    public async Task<ActionResult<RadiusUserResponse>> GetUserByUuid(Guid uuid)
    {
        var user = await _context.RadiusUsers
            .IgnoreQueryFilters()
            .Include(u => u.RadiusGroup)
            .Include(u => u.Profile)
            .FirstOrDefaultAsync(u => u.Uuid == uuid);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Get IP reservation for this user
        var ipReservation = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId == user.Id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        var response = new RadiusUserResponse
        {
            Id = user.Id,
            Uuid = user.Uuid,
            ExternalId = user.ExternalId,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            City = user.City,
            Phone = user.Phone,
            Email = user.Email,
            ProfileId = user.ProfileId,
            ProfileName = user.Profile?.Name,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            Enabled = user.Enabled,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = CalculateRemainingDays(user.Expiration),
            DebtDays = user.DebtDays,
            StaticIp = ipReservation?.IpAddress,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            Notes = user.Notes,
            GpsLat = user.GpsLat,
            GpsLng = user.GpsLng,
            GroupId = user.GroupId,
            GroupName = user.RadiusGroup != null ? user.RadiusGroup.Name : null,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt,
            DeletedAt = user.DeletedAt,
            DeletedBy = user.DeletedBy
        };

        return Ok(response);
    }

    // POST: api/radius/users
    [HttpPost]
    public async Task<ActionResult<RadiusUserResponse>> CreateUser([FromBody] CreateUserRequest request)
    {
        var user = new RadiusUser
        {
            ExternalId = 0, // Will be set when synced with SAS
            Username = request.Username,
            Password = request.Password,
            Firstname = request.Firstname,
            Lastname = request.Lastname,
            Email = request.Email,
            Phone = request.Phone,
            City = request.City,
            ProfileId = request.ProfileId,
            Balance = request.Balance,
            Expiration = request.Expiration,
            Enabled = request.Enabled,
            // StaticIp is managed via IP Reservations, not set here
            Company = request.Company,
            Address = request.Address,
            ContractId = request.ContractId,
            Notes = request.Notes,
            DeviceSerialNumber = request.DeviceSerialNumber,
            GpsLat = request.GpsLat,
            GpsLng = request.GpsLng,
            SimultaneousSessions = request.SimultaneousSessions,
            ZoneId = request.ZoneId,
            GroupId = request.GroupId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.RadiusUsers.Add(user);
        await _context.SaveChangesAsync();

        // Get IP reservation for this user
        var ipReservation = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId == user.Id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        var response = new RadiusUserResponse
        {
            Id = user.Id,
            Uuid = user.Uuid,
            ExternalId = user.ExternalId,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            City = user.City,
            Phone = user.Phone,
            Email = user.Email,
            ProfileId = user.ProfileId,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            Enabled = user.Enabled,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = CalculateRemainingDays(user.Expiration),
            DebtDays = user.DebtDays,
            StaticIp = ipReservation?.IpAddress,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            Notes = user.Notes,
            DeviceSerialNumber = user.DeviceSerialNumber,
            GpsLat = user.GpsLat,
            GpsLng = user.GpsLng,
            GroupId = user.GroupId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return CreatedAtAction(nameof(GetUserByUuid), new { uuid = user.Uuid }, response);
    }

    // PUT: api/radius/users/uuid/{uuid}
    [HttpPut("uuid/{uuid:guid}")]
    public async Task<ActionResult<RadiusUserResponse>> UpdateUserByUuid(Guid uuid, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Uuid == uuid);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Track changes for history
        var changes = new List<string>();
        
        // Update only provided fields
        if (request.Username != null && request.Username != user.Username) 
        {
            changes.Add($"Username: '{user.Username}' → '{request.Username}'");
            user.Username = request.Username;
        }
        if (request.Password != null)
        {
            changes.Add("Password changed");
            user.Password = request.Password;
        }
        if (request.Firstname != null && request.Firstname != user.Firstname)
        {
            changes.Add($"First name: '{user.Firstname}' → '{request.Firstname}'");
            user.Firstname = request.Firstname;
        }
        if (request.Lastname != null && request.Lastname != user.Lastname)
        {
            changes.Add($"Last name: '{user.Lastname}' → '{request.Lastname}'");
            user.Lastname = request.Lastname;
        }
        if (request.Email != null && request.Email != user.Email)
        {
            changes.Add($"Email: '{user.Email}' → '{request.Email}'");
            user.Email = request.Email;
        }
        if (request.Phone != null && request.Phone != user.Phone)
        {
            changes.Add($"Phone: '{user.Phone}' → '{request.Phone}'");
            user.Phone = request.Phone;
        }
        if (request.City != null && request.City != user.City)
        {
            changes.Add($"City: '{user.City}' → '{request.City}'");
            user.City = request.City;
        }
        if (request.ProfileId.HasValue && request.ProfileId != user.ProfileId)
        {
            changes.Add($"Profile ID: {user.ProfileId} → {request.ProfileId}");
            user.ProfileId = request.ProfileId;
        }
        if (request.Balance.HasValue && request.Balance != user.Balance)
        {
            changes.Add($"Balance: {user.Balance} → {request.Balance}");
            user.Balance = request.Balance.Value;
        }
        if (request.Expiration.HasValue) 
        {
            var newExpiration = request.Expiration.Value.Kind == DateTimeKind.Utc 
                ? request.Expiration 
                : DateTime.SpecifyKind(request.Expiration.Value, DateTimeKind.Utc);
            if (newExpiration != user.Expiration)
            {
                changes.Add($"Expiration: {user.Expiration} → {newExpiration}");
                user.Expiration = newExpiration;
            }
        }
        if (request.Enabled.HasValue && request.Enabled != user.Enabled)
        {
            changes.Add($"Enabled: {user.Enabled} → {request.Enabled}");
            user.Enabled = request.Enabled.Value;
        }
        if (request.Company != null && request.Company != user.Company)
        {
            changes.Add($"Company: '{user.Company}' → '{request.Company}'");
            user.Company = request.Company;
        }
        if (request.Address != null && request.Address != user.Address)
        {
            changes.Add($"Address: '{user.Address}' → '{request.Address}'");
            user.Address = request.Address;
        }
        if (request.ContractId != null && request.ContractId != user.ContractId)
        {
            changes.Add($"Contract ID: '{user.ContractId}' → '{request.ContractId}'");
            user.ContractId = request.ContractId;
        }
        if (request.Notes != null && request.Notes != user.Notes)
        {
            changes.Add($"Notes: '{user.Notes}' → '{request.Notes}'");
            user.Notes = request.Notes;
        }
        if (request.DeviceSerialNumber != null && request.DeviceSerialNumber != user.DeviceSerialNumber)
        {
            changes.Add($"Device Serial: '{user.DeviceSerialNumber}' → '{request.DeviceSerialNumber}'");
            user.DeviceSerialNumber = request.DeviceSerialNumber;
        }
        if (request.GpsLat != null && request.GpsLat != user.GpsLat)
        {
            changes.Add($"GPS Lat: {user.GpsLat} → {request.GpsLat}");
            user.GpsLat = request.GpsLat;
        }
        if (request.GpsLng != null && request.GpsLng != user.GpsLng)
        {
            changes.Add($"GPS Lng: {user.GpsLng} → {request.GpsLng}");
            user.GpsLng = request.GpsLng;
        }
        if (request.SimultaneousSessions.HasValue && request.SimultaneousSessions != user.SimultaneousSessions)
        {
            changes.Add($"Simultaneous Sessions: {user.SimultaneousSessions} → {request.SimultaneousSessions}");
            user.SimultaneousSessions = request.SimultaneousSessions.Value;
        }
        if (request.ZoneId.HasValue && request.ZoneId != user.ZoneId)
        {
            changes.Add($"Zone ID: {user.ZoneId} → {request.ZoneId}");
            user.ZoneId = request.ZoneId;
        }
        if (request.GroupId.HasValue && request.GroupId != user.GroupId)
        {
            changes.Add($"Group ID: {user.GroupId} → {request.GroupId}");
            user.GroupId = request.GroupId;
        }

        user.UpdatedAt = DateTime.UtcNow;

        // Log history entry if there were changes
        if (changes.Any())
        {
            var history = new RadiusUserHistory
            {
                RadiusUserId = user.Id,
                EventType = "info_update",
                Action = "Updated",
                Description = $"User information updated: {string.Join(", ", changes)}",
                Changes = System.Text.Json.JsonSerializer.Serialize(changes),
                PerformedBy = User.Identity?.Name ?? "System",
                PerformedById = User.GetSystemUserId(),
                PerformedAt = DateTime.UtcNow,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = HttpContext.Request.Headers["User-Agent"].ToString()
            };
            _context.RadiusUserHistories.Add(history);
        }

        await _context.SaveChangesAsync();

        // Get IP reservation for this user
        var updateUserIpReservation = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId == user.Id && r.DeletedAt == null)
            .FirstOrDefaultAsync();

        var response = new RadiusUserResponse
        {
            Id = user.Id,
            Uuid = user.Uuid,
            ExternalId = user.ExternalId,
            Username = user.Username,
            Firstname = user.Firstname,
            Lastname = user.Lastname,
            City = user.City,
            Phone = user.Phone,
            Email = user.Email,
            ProfileId = user.ProfileId,
            Balance = user.Balance,
            LoanBalance = user.LoanBalance,
            Expiration = user.Expiration,
            LastOnline = user.LastOnline,
            Enabled = user.Enabled,
            OnlineStatus = user.OnlineStatus,
            RemainingDays = CalculateRemainingDays(user.Expiration),
            DebtDays = user.DebtDays,
            StaticIp = updateUserIpReservation?.IpAddress,
            Company = user.Company,
            Address = user.Address,
            ContractId = user.ContractId,
            GroupId = user.GroupId,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSyncedAt = user.LastSyncedAt
        };

        return Ok(response);
    }

    // PUT: api/radius/users/uuid/{uuid}/username
    [HttpPut("uuid/{uuid:guid}/username")]
    public async Task<ActionResult> ChangeUsernameByUuid(Guid uuid, [FromBody] ChangeUsernameRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewUsername))
        {
            return BadRequest(new { message = "New username is required" });
        }

        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Uuid == uuid && !u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Check if new username already exists
        var existingUser = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Username == request.NewUsername && u.Id != user.Id && !u.IsDeleted);

        if (existingUser != null)
        {
            return BadRequest(new { message = "Username already exists" });
        }

        var oldUsername = user.Username;
        user.Username = request.NewUsername;
        user.UpdatedAt = DateTime.UtcNow;

        // Log history entry for username change
        var history = new RadiusUserHistory
        {
            RadiusUserId = user.Id,
            EventType = "username_change",
            Action = "Updated",
            Description = $"Username changed from '{oldUsername}' to '{request.NewUsername}'",
            OldValue = oldUsername,
            NewValue = request.NewUsername,
            PerformedBy = User.Identity?.Name ?? "System",
            PerformedById = User.GetSystemUserId(),
            PerformedAt = DateTime.UtcNow,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext.Request.Headers["User-Agent"].ToString()
        };
        _context.RadiusUserHistories.Add(history);

        await _context.SaveChangesAsync();

        return Ok(new { message = "Username changed successfully", username = user.Username });
    }

    // DELETE: api/radius/users/uuid/{uuid}
    [HttpDelete("uuid/{uuid:guid}")]
    public async Task<IActionResult> DeleteUserByUuid(Guid uuid)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Uuid == uuid && !u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        user.DeletedBy = User.GetSystemUserId();
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/users/uuid/{uuid}/restore
    [HttpPost("uuid/{uuid:guid}/restore")]
    public async Task<IActionResult> RestoreUser(Guid uuid)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Uuid == uuid && u.IsDeleted);

        if (user == null)
        {
            return NotFound(new { message = "Deleted user not found" });
        }

        user.IsDeleted = false;
        user.DeletedAt = null;
        user.DeletedBy = null;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/radius/users/bulk-delete
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDeleteUsers([FromBody] BulkOperationRequest request)
    {
        if (request.UserIds == null || !request.UserIds.Any())
        {
            return BadRequest(new { message = "No user IDs provided" });
        }

        var users = await _context.RadiusUsers
            .Where(u => request.UserIds.Contains(u.Id) && !u.IsDeleted)
            .ToListAsync();

        if (!users.Any())
        {
            return NotFound(new { message = "No users found to delete" });
        }

        var deletedBy = User.GetSystemUserId();
        foreach (var user in users)
        {
            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
            user.DeletedBy = deletedBy;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{users.Count} user(s) deleted successfully", count = users.Count });
    }

    // POST: api/radius/users/bulk-restore
    [HttpPost("bulk-restore")]
    public async Task<IActionResult> BulkRestoreUsers([FromBody] BulkOperationRequest request)
    {
        if (request.UserIds == null || !request.UserIds.Any())
        {
            return BadRequest(new { message = "No user IDs provided" });
        }

        var users = await _context.RadiusUsers
            .Where(u => request.UserIds.Contains(u.Id) && u.IsDeleted)
            .ToListAsync();

        if (!users.Any())
        {
            return NotFound(new { message = "No deleted users found to restore" });
        }

        foreach (var user in users)
        {
            user.IsDeleted = false;
            user.DeletedAt = null;
            user.DeletedBy = null;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{users.Count} user(s) restored successfully", count = users.Count });
    }

    // POST: api/radius/users/bulk-renew
    [HttpPost("bulk-renew")]
    public async Task<IActionResult> BulkRenewUsers([FromBody] BulkOperationRequest request)
    {
        if (request.UserIds == null || !request.UserIds.Any())
        {
            return BadRequest(new { message = "No user IDs provided" });
        }

        var users = await _context.RadiusUsers
            .Where(u => request.UserIds.Contains(u.Id) && !u.IsDeleted)
            .ToListAsync();

        if (!users.Any())
        {
            return NotFound(new { message = "No users found to renew" });
        }

        foreach (var user in users)
        {
            if (user.Expiration.HasValue)
            {
                user.Expiration = user.Expiration.Value.AddDays(30);
            }
            else
            {
                user.Expiration = DateTime.UtcNow.AddDays(30);
            }
            user.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"{users.Count} user(s) renewed successfully", count = users.Count });
    }

    // GET: api/radius/users/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Include(u => u.RadiusGroup)
            .Where(u => u.IsDeleted);

        // Zone-based filtering for non-admin users
        var systemUserId = User.GetSystemUserId();
        var isAdmin = User.IsAdmin();
        
        if (!isAdmin && systemUserId.HasValue)
        {
            // Get zones managed by this user
            var userZoneIds = await _context.UserZones
                .Where(uz => uz.UserId == systemUserId.Value)
                .Select(uz => uz.ZoneId)
                .ToListAsync();
            
            if (userZoneIds.Any())
            {
                // Filter RADIUS users to only show users in managed zones
                query = query.Where(u => u.ZoneId.HasValue && userZoneIds.Contains(u.ZoneId.Value));
            }
            else
            {
                // User has no zones assigned, show no RADIUS users
                query = query.Where(u => false);
            }
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Get IP reservations for users
        var userIds = users.Select(u => u.Id).ToList();
        var ipReservations = await _context.RadiusIpReservations
            .Where(r => r.RadiusUserId.HasValue && userIds.Contains(r.RadiusUserId.Value) && r.DeletedAt == null)
            .ToListAsync();
        var userIpMap = ipReservations
            .GroupBy(r => r.RadiusUserId!.Value)
            .ToDictionary(g => g.Key, g => g.First().IpAddress);

        var response = users.Select(u => new RadiusUserResponse
        {
            Id = u.Id,
            Uuid = u.Uuid,
            ExternalId = u.ExternalId,
            Username = u.Username,
            Firstname = u.Firstname,
            Lastname = u.Lastname,
            Email = u.Email,
            Phone = u.Phone,
            ProfileId = u.ProfileId,
            ProfileName = u.Profile?.Name,
            Balance = u.Balance,
            Enabled = u.Enabled,
            StaticIp = userIpMap.ContainsKey(u.Id) ? userIpMap[u.Id] : null,
            DeletedAt = u.DeletedAt,
            DeletedBy = u.DeletedBy,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            ZoneId = u.ZoneId,
            ZoneName = u.Zone != null ? u.Zone.Name : null,
            ZoneColor = u.Zone != null ? u.Zone.Color : null,
            GroupId = u.GroupId,
            GroupName = u.RadiusGroup != null ? u.RadiusGroup.Name : null
        });

        return Ok(new
        {
            data = response,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    // POST: api/radius/users/sync
    [HttpPost("sync")]
    public async Task<ActionResult<SyncUsersResponse>> SyncUsers()
    {
        var syncStartTime = DateTime.UtcNow;
        var syncId = Guid.NewGuid().ToString();

        try
        {
            // TODO: Implement actual SAS Radius server sync
            // This is a placeholder that returns mock data
            
            // For now, return a mock successful sync response
            var response = new SyncUsersResponse
            {
                SyncId = syncId,
                Success = true,
                Message = "Sync completed successfully",
                TotalUsers = 0,
                NewUsers = 0,
                UpdatedUsers = 0,
                FailedUsers = 0,
                StartedAt = syncStartTime,
                CompletedAt = DateTime.UtcNow,
                ErrorMessage = null
            };

            _logger.LogInformation(
                "User sync completed. New: {New}, Updated: {Updated}, Failed: {Failed}",
                response.NewUsers, response.UpdatedUsers, response.FailedUsers
            );

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing users");

            var response = new SyncUsersResponse
            {
                SyncId = syncId,
                Success = false,
                Message = "Sync failed",
                TotalUsers = 0,
                NewUsers = 0,
                UpdatedUsers = 0,
                FailedUsers = 0,
                StartedAt = syncStartTime,
                CompletedAt = DateTime.UtcNow,
                ErrorMessage = ex.Message
            };

            return StatusCode(500, response);
        }
    }

    // GET: api/radius/users/export/csv
    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportToCsv(
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] string? filters = null)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Where(u => !u.IsDeleted);

        // Zone-based filtering for non-admin users
        var systemUserId = User.GetSystemUserId();
        var isAdmin = User.IsAdmin();
        
        if (!isAdmin && systemUserId.HasValue)
        {
            // Get zones managed by this user
            var userZoneIds = await _context.UserZones
                .Where(uz => uz.UserId == systemUserId.Value)
                .Select(uz => uz.ZoneId)
                .ToListAsync();
            
            if (userZoneIds.Any())
            {
                // Filter RADIUS users to only show users in managed zones
                query = query.Where(u => u.ZoneId.HasValue && userZoneIds.Contains(u.ZoneId.Value));
            }
            else
            {
                // User has no zones assigned, show no RADIUS users
                query = query.Where(u => false);
            }
        }

        // Apply advanced filters
        if (!string.IsNullOrEmpty(filters))
        {
            try
            {
                var filterGroup = System.Text.Json.JsonSerializer.Deserialize<FilterGroup>(filters, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                query = ApplyAdvancedFilters(query, filterGroup);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to parse filters in export: {Error}", ex.Message);
            }
        }

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u =>
                (u.Username != null && u.Username.ToLower().Contains(searchLower)) ||
                (u.Firstname != null && u.Firstname.ToLower().Contains(searchLower)) ||
                (u.Lastname != null && u.Lastname.ToLower().Contains(searchLower)) ||
                (u.Email != null && u.Email.ToLower().Contains(searchLower)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "username" => isDescending ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
                "name" => isDescending ? query.OrderByDescending(u => u.Firstname).ThenByDescending(u => u.Lastname) : query.OrderBy(u => u.Firstname).ThenBy(u => u.Lastname),
                "email" => isDescending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
                "phone" => isDescending ? query.OrderByDescending(u => u.Phone) : query.OrderBy(u => u.Phone),
                "enabled" => isDescending ? query.OrderByDescending(u => u.Enabled) : query.OrderBy(u => u.Enabled),
                "balance" => isDescending ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(u => u.CreatedAt);
        }

        var users = await query.ToListAsync();

        var memoryStream = new MemoryStream();
        var writer = new StreamWriter(memoryStream, new UTF8Encoding(true));
        var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
        });

        // Write headers
        csv.WriteField("Username");
        csv.WriteField("First Name");
        csv.WriteField("Last Name");
        csv.WriteField("Email");
        csv.WriteField("Phone");
        csv.WriteField("City");
        csv.WriteField("Profile");
        csv.WriteField("Status");
        csv.WriteField("Balance");
        csv.WriteField("Loan Balance");
        csv.WriteField("Expiration");
        csv.WriteField("Last Online");
        csv.WriteField("Online Status");
        csv.WriteField("Remaining Days");
        csv.WriteField("Debt Days");
        csv.WriteField("Static IP");
        csv.WriteField("Company");
        csv.WriteField("Address");
        csv.WriteField("Contract ID");
        csv.WriteField("Simultaneous Sessions");
        csv.WriteField("Created At");
        csv.NextRecord();

        // Write data
        foreach (var user in users)
        {
            csv.WriteField(user.Username ?? "");
            csv.WriteField(user.Firstname ?? "");
            csv.WriteField(user.Lastname ?? "");
            csv.WriteField(user.Email ?? "");
            csv.WriteField(user.Phone ?? "");
            csv.WriteField(user.City ?? "");
            csv.WriteField(user.Profile?.Name ?? "");
            csv.WriteField(user.Enabled ? "Enabled" : "Disabled");
            csv.WriteField(user.Balance.ToString("F2"));
            csv.WriteField(user.LoanBalance.ToString("F2"));
            csv.WriteField(user.Expiration?.ToString("yyyy-MM-dd") ?? "");
            csv.WriteField(user.LastOnline?.ToString("yyyy-MM-dd HH:mm:ss") ?? "");
            csv.WriteField(user.OnlineStatus == 1 ? "Online" : "Offline");
            csv.WriteField(user.RemainingDays.ToString());
            csv.WriteField(user.DebtDays.ToString());
            csv.WriteField(user.StaticIp ?? "");
            csv.WriteField(user.Company ?? "");
            csv.WriteField(user.Address ?? "");
            csv.WriteField(user.ContractId ?? "");
            csv.WriteField(user.SimultaneousSessions.ToString());
            csv.WriteField(user.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"));
            csv.NextRecord();
        }

        await csv.FlushAsync();
        await writer.FlushAsync();
        memoryStream.Position = 0;

        var fileName = $"radius_users_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";
        return File(memoryStream, "text/csv", fileName);
    }

    // GET: api/radius/users/export/excel
    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportToExcel(
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] string? filters = null)
    {
        var query = _context.RadiusUsers
            .Include(u => u.Profile)
            .Where(u => !u.IsDeleted);

        // Zone-based filtering for non-admin users
        var systemUserId = User.GetSystemUserId();
        var isAdmin = User.IsAdmin();
        
        if (!isAdmin && systemUserId.HasValue)
        {
            // Get zones managed by this user
            var userZoneIds = await _context.UserZones
                .Where(uz => uz.UserId == systemUserId.Value)
                .Select(uz => uz.ZoneId)
                .ToListAsync();
            
            if (userZoneIds.Any())
            {
                // Filter RADIUS users to only show users in managed zones
                query = query.Where(u => u.ZoneId.HasValue && userZoneIds.Contains(u.ZoneId.Value));
            }
            else
            {
                // User has no zones assigned, show no RADIUS users
                query = query.Where(u => false);
            }
        }

        // Apply advanced filters
        if (!string.IsNullOrEmpty(filters))
        {
            try
            {
                var filterGroup = System.Text.Json.JsonSerializer.Deserialize<FilterGroup>(filters, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                query = ApplyAdvancedFilters(query, filterGroup);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to parse filters in export: {Error}", ex.Message);
            }
        }

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u =>
                (u.Username != null && u.Username.ToLower().Contains(searchLower)) ||
                (u.Firstname != null && u.Firstname.ToLower().Contains(searchLower)) ||
                (u.Lastname != null && u.Lastname.ToLower().Contains(searchLower)) ||
                (u.Email != null && u.Email.ToLower().Contains(searchLower)) ||
                (u.Phone != null && u.Phone.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "username" => isDescending ? query.OrderByDescending(u => u.Username) : query.OrderBy(u => u.Username),
                "name" => isDescending ? query.OrderByDescending(u => u.Firstname).ThenByDescending(u => u.Lastname) : query.OrderBy(u => u.Firstname).ThenBy(u => u.Lastname),
                "email" => isDescending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
                "phone" => isDescending ? query.OrderByDescending(u => u.Phone) : query.OrderBy(u => u.Phone),
                "enabled" => isDescending ? query.OrderByDescending(u => u.Enabled) : query.OrderBy(u => u.Enabled),
                "balance" => isDescending ? query.OrderByDescending(u => u.Balance) : query.OrderBy(u => u.Balance),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(u => u.CreatedAt);
        }

        var users = await query.ToListAsync();

        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add("RADIUS Users");

        // Headers
        worksheet.Cells[1, 1].Value = "Username";
        worksheet.Cells[1, 2].Value = "First Name";
        worksheet.Cells[1, 3].Value = "Last Name";
        worksheet.Cells[1, 4].Value = "Email";
        worksheet.Cells[1, 5].Value = "Phone";
        worksheet.Cells[1, 6].Value = "City";
        worksheet.Cells[1, 7].Value = "Profile";
        worksheet.Cells[1, 8].Value = "Status";
        worksheet.Cells[1, 9].Value = "Balance";
        worksheet.Cells[1, 10].Value = "Loan Balance";
        worksheet.Cells[1, 11].Value = "Expiration";
        worksheet.Cells[1, 12].Value = "Last Online";
        worksheet.Cells[1, 13].Value = "Online Status";
        worksheet.Cells[1, 14].Value = "Remaining Days";
        worksheet.Cells[1, 15].Value = "Debt Days";
        worksheet.Cells[1, 16].Value = "Static IP";
        worksheet.Cells[1, 17].Value = "Company";
        worksheet.Cells[1, 18].Value = "Address";
        worksheet.Cells[1, 19].Value = "Contract ID";
        worksheet.Cells[1, 20].Value = "Simultaneous Sessions";
        worksheet.Cells[1, 21].Value = "Created At";

        // Style headers
        using (var range = worksheet.Cells[1, 1, 1, 21])
        {
            range.Style.Font.Bold = true;
            range.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            range.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightBlue);
            range.Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
        }

        // Data
        int row = 2;
        foreach (var user in users)
        {
            worksheet.Cells[row, 1].Value = user.Username ?? "";
            worksheet.Cells[row, 2].Value = user.Firstname ?? "";
            worksheet.Cells[row, 3].Value = user.Lastname ?? "";
            worksheet.Cells[row, 4].Value = user.Email ?? "";
            worksheet.Cells[row, 5].Value = user.Phone ?? "";
            worksheet.Cells[row, 6].Value = user.City ?? "";
            worksheet.Cells[row, 7].Value = user.Profile?.Name ?? "";
            worksheet.Cells[row, 8].Value = user.Enabled ? "Enabled" : "Disabled";
            worksheet.Cells[row, 9].Value = user.Balance;
            worksheet.Cells[row, 10].Value = user.LoanBalance;
            worksheet.Cells[row, 11].Value = user.Expiration?.ToString("yyyy-MM-dd") ?? "";
            worksheet.Cells[row, 12].Value = user.LastOnline?.ToString("yyyy-MM-dd HH:mm:ss") ?? "";
            worksheet.Cells[row, 13].Value = user.OnlineStatus == 1 ? "Online" : "Offline";
            worksheet.Cells[row, 14].Value = user.RemainingDays;
            worksheet.Cells[row, 15].Value = user.DebtDays;
            worksheet.Cells[row, 16].Value = user.StaticIp ?? "";
            worksheet.Cells[row, 17].Value = user.Company ?? "";
            worksheet.Cells[row, 18].Value = user.Address ?? "";
            worksheet.Cells[row, 19].Value = user.ContractId ?? "";
            worksheet.Cells[row, 20].Value = user.SimultaneousSessions;
            worksheet.Cells[row, 21].Value = user.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
            row++;
        }

        // Auto-fit columns
        worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();

        var fileName = $"radius_users_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
        var fileBytes = package.GetAsByteArray();

        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    // GET: api/radius/users/uuid/{uuid}/history
    [HttpGet("uuid/{uuid:guid}/history")]
    public async Task<ActionResult<object>> GetUserHistory(
        Guid uuid,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? eventType = null)
    {
        var user = await _context.RadiusUsers
            .FirstOrDefaultAsync(u => u.Uuid == uuid);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var query = _context.RadiusUserHistories
            .Where(h => h.RadiusUserId == user.Id);

        if (!string.IsNullOrEmpty(eventType) && eventType != "all")
        {
            query = query.Where(h => h.EventType == eventType);
        }

        var totalCount = await query.CountAsync();

        var history = await query
            .OrderByDescending(h => h.PerformedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(h => new
            {
                h.Id,
                h.Uuid,
                h.EventType,
                h.Action,
                h.Description,
                h.Changes,
                h.OldValue,
                h.NewValue,
                h.PerformedBy,
                h.PerformedAt,
                h.IpAddress,
                h.UserAgent
            })
            .ToListAsync();

        return Ok(new
        {
            data = history,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    // POST: api/radius/users/uuid/{uuid}/tags
    [HttpPost("uuid/{uuid:guid}/tags")]
    public async Task<IActionResult> AssignTags(Guid uuid, [FromBody] List<int> tagIds)
    {
        try
        {
            var user = await _context.RadiusUsers
                .Include(u => u.RadiusUserTags)
                .FirstOrDefaultAsync(u => u.Uuid == uuid && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Remove existing tags
            _context.RadiusUserTags.RemoveRange(user.RadiusUserTags);

            // Add new tags
            foreach (var tagId in tagIds)
            {
                user.RadiusUserTags.Add(new RadiusUserTag
                {
                    RadiusUserId = user.Id,
                    RadiusTagId = tagId,
                    AssignedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Tags updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning tags to user {UserUuid}", uuid);
            return StatusCode(500, new { message = "Failed to assign tags" });
        }
    }

    // GET: api/radius/users/uuid/{uuid}/tags
    [HttpGet("uuid/{uuid:guid}/tags")]
    public async Task<ActionResult<IEnumerable<object>>> GetUserTags(Guid uuid)
    {
        try
        {
            var user = await _context.RadiusUsers
                .FirstOrDefaultAsync(u => u.Uuid == uuid && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var tags = await _context.RadiusUserTags
                .Where(rut => rut.RadiusUserId == user.Id)
                .Select(rut => new
                {
                    rut.RadiusTag.Id,
                    rut.RadiusTag.Title,
                    rut.RadiusTag.Description,
                    rut.RadiusTag.Status,
                    rut.RadiusTag.Color,
                    rut.AssignedAt
                })
                .ToListAsync();

            return Ok(tags);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching tags for user {UserUuid}", uuid);
            return StatusCode(500, new { message = "Failed to fetch user tags" });
        }
    }

    // POST: api/workspace/{workspaceId}/radius-users/assign-zone
    [HttpPost("assign-zone")]
    public async Task<IActionResult> AssignZoneToUsers(int workspaceId, [FromBody] AssignZoneDto dto)
    {
        try
        {
            var users = await _context.RadiusUsers
                .Where(u => dto.UserIds.Contains(u.Id) && !u.IsDeleted)
                .ToListAsync();

            if (users.Count == 0)
            {
                return NotFound(new { message = "No valid users found" });
            }

            foreach (var user in users)
            {
                user.ZoneId = dto.ZoneId;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Zone assigned successfully", count = users.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning zone to users");
            return StatusCode(500, new { message = "Failed to assign zone" });
        }
    }
}

public class ChangeUsernameRequest
{
    public string NewUsername { get; set; } = string.Empty;
}

public class AssignZoneDto
{
    public List<int> UserIds { get; set; } = new();
    public int? ZoneId { get; set; }
}
