using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        ApplicationDbContext context,
        ILogger<DashboardController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/dashboard
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetDashboards()
    {
        try
        {
            var dashboards = await _context.Dashboards
                .Where(d => !d.IsDeleted)
                .Include(d => d.Tabs.Where(t => !t.IsDeleted))
                .Include(d => d.GlobalFilters.Where(f => !f.IsDeleted))
                .OrderByDescending(d => d.UpdatedAt)
                .Select(d => new
                {
                    id = d.Id.ToString(),
                    name = d.Name,
                    description = d.Description,
                    icon = d.Icon,
                    color = d.Color,
                    createdAt = d.CreatedAt.ToString("o"),
                    updatedAt = d.UpdatedAt.ToString("o"),
                    tabCount = d.Tabs.Count(t => !t.IsDeleted),
                    itemCount = d.Tabs
                        .Where(t => !t.IsDeleted)
                        .SelectMany(t => t.Items.Where(i => !i.IsDeleted))
                        .Count()
                })
                .ToListAsync();

            return Ok(dashboards);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboards");
            return StatusCode(500, new { message = "Error retrieving dashboards" });
        }
    }

    // GET: api/dashboard/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetDashboard(int id)
    {
        try
        {
            var dashboard = await _context.Dashboards
                .Where(d => d.Id == id && !d.IsDeleted)
                .Include(d => d.Tabs.Where(t => !t.IsDeleted))
                    .ThenInclude(t => t.Items.Where(i => !i.IsDeleted))
                .Include(d => d.GlobalFilters.Where(f => !f.IsDeleted))
                .Select(d => new
                {
                    id = d.Id.ToString(),
                    name = d.Name,
                    description = d.Description,
                    icon = d.Icon,
                    color = d.Color,
                    tabs = d.Tabs
                        .Where(t => !t.IsDeleted)
                        .OrderBy(t => t.OrderIndex)
                        .Select(t => new
                        {
                            id = t.Id.ToString(),
                            name = t.Name,
                            items = t.Items
                                .Where(i => !i.IsDeleted)
                                .Select(i => new
                                {
                                    id = i.Id.ToString(),
                                    type = i.Type,
                                    title = i.Title,
                                    layout = new
                                    {
                                        x = i.LayoutX,
                                        y = i.LayoutY,
                                        w = i.LayoutW,
                                        h = i.LayoutH
                                    },
                                    config = JsonSerializer.Deserialize<JsonElement>(i.Config)
                                })
                                .ToList()
                        })
                        .ToList(),
                    globalFilters = d.GlobalFilters
                        .Where(f => !f.IsDeleted)
                        .OrderBy(f => f.OrderIndex)
                        .Select(f => new
                        {
                            id = f.Id.ToString(),
                            label = f.Label,
                            type = f.Type,
                            value = f.Value != null ? JsonSerializer.Deserialize<JsonElement>(f.Value) : (JsonElement?)null,
                            options = f.Options != null ? JsonSerializer.Deserialize<JsonElement>(f.Options) : (JsonElement?)null
                        })
                        .ToList(),
                    createdAt = d.CreatedAt.ToString("o"),
                    updatedAt = d.UpdatedAt.ToString("o")
                })
                .FirstOrDefaultAsync();

            if (dashboard == null)
            {
                return NotFound(new { message = "Dashboard not found" });
            }

            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboard {DashboardId}", id);
            return StatusCode(500, new { message = "Error retrieving dashboard" });
        }
    }

    // POST: api/dashboard
    [HttpPost]
    public async Task<ActionResult<object>> CreateDashboard([FromBody] CreateDashboardDto dto)
    {
        try
        {
            var dashboard = new Dashboard
            {
                Name = dto.Name,
                Description = dto.Description,
                Icon = dto.Icon,
                Color = dto.Color,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Add default tab if none provided
            if (dto.Tabs == null || !dto.Tabs.Any())
            {
                dashboard.Tabs.Add(new DashboardTab
                {
                    Name = "Overview",
                    OrderIndex = 0
                });
            }
            else
            {
                var orderIndex = 0;
                foreach (var tabDto in dto.Tabs)
                {
                    dashboard.Tabs.Add(new DashboardTab
                    {
                        Name = tabDto.Name,
                        OrderIndex = orderIndex++
                    });
                }
            }

            _context.Dashboards.Add(dashboard);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetDashboard),
                new { id = dashboard.Id },
                new
                {
                    id = dashboard.Id.ToString(),
                    name = dashboard.Name,
                    description = dashboard.Description,
                    createdAt = dashboard.CreatedAt.ToString("o"),
                    updatedAt = dashboard.UpdatedAt.ToString("o")
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating dashboard");
            return StatusCode(500, new { message = "Error creating dashboard" });
        }
    }

    // PUT: api/dashboard/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDashboard(int id, [FromBody] UpdateDashboardDto dto)
    {
        try
        {
            var dashboard = await _context.Dashboards
                .Where(d => d.Id == id && !d.IsDeleted)
                .Include(d => d.Tabs)
                .Include(d => d.GlobalFilters)
                .FirstOrDefaultAsync();

            if (dashboard == null)
            {
                return NotFound(new { message = "Dashboard not found" });
            }

            dashboard.Name = dto.Name ?? dashboard.Name;
            dashboard.Description = dto.Description ?? dashboard.Description;
            dashboard.Icon = dto.Icon ?? dashboard.Icon;
            dashboard.Color = dto.Color ?? dashboard.Color;
            dashboard.UpdatedAt = DateTime.UtcNow;

            // Update tabs if provided
            if (dto.Tabs != null)
            {
                // Mark all existing tabs as deleted
                foreach (var tab in dashboard.Tabs)
                {
                    tab.IsDeleted = true;
                }

                // Add new tabs
                var orderIndex = 0;
                foreach (var tabDto in dto.Tabs)
                {
                    dashboard.Tabs.Add(new DashboardTab
                    {
                        Name = tabDto.Name,
                        OrderIndex = orderIndex++
                    });
                }
            }

            // Update global filters if provided
            if (dto.GlobalFilters != null)
            {
                // Mark all existing filters as deleted
                foreach (var filter in dashboard.GlobalFilters)
                {
                    filter.IsDeleted = true;
                }

                // Add new filters
                var orderIndex = 0;
                foreach (var filterDto in dto.GlobalFilters)
                {
                    dashboard.GlobalFilters.Add(new DashboardGlobalFilter
                    {
                        Label = filterDto.Label,
                        Type = filterDto.Type,
                        Value = filterDto.Value != null ? JsonSerializer.Serialize(filterDto.Value) : null,
                        Options = filterDto.Options != null ? JsonSerializer.Serialize(filterDto.Options) : null,
                        OrderIndex = orderIndex++
                    });
                }
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating dashboard {DashboardId}", id);
            return StatusCode(500, new { message = "Error updating dashboard" });
        }
    }

    // DELETE: api/dashboard/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDashboard(int id)
    {
        try
        {
            var dashboard = await _context.Dashboards
                .Where(d => d.Id == id && !d.IsDeleted)
                .FirstOrDefaultAsync();

            if (dashboard == null)
            {
                return NotFound(new { message = "Dashboard not found" });
            }

            dashboard.IsDeleted = true;
            dashboard.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting dashboard {DashboardId}", id);
            return StatusCode(500, new { message = "Error deleting dashboard" });
        }
    }

    // POST: api/dashboard/{id}/items
    [HttpPost("{id}/items")]
    public async Task<ActionResult<object>> AddItem(int id, [FromBody] AddItemDto dto)
    {
        try
        {
            var tab = await _context.DashboardTabs
                .Where(t => t.Id == dto.TabId && t.DashboardId == id && !t.IsDeleted)
                .FirstOrDefaultAsync();

            if (tab == null)
            {
                return NotFound(new { message = "Tab not found" });
            }

            var item = new DashboardItem
            {
                TabId = dto.TabId,
                Type = dto.Type,
                Title = dto.Title,
                LayoutX = dto.Layout.X,
                LayoutY = dto.Layout.Y,
                LayoutW = dto.Layout.W,
                LayoutH = dto.Layout.H,
                Config = JsonSerializer.Serialize(dto.Config)
            };

            _context.DashboardItems.Add(item);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = item.Id.ToString(),
                type = item.Type,
                title = item.Title,
                layout = new
                {
                    x = item.LayoutX,
                    y = item.LayoutY,
                    w = item.LayoutW,
                    h = item.LayoutH
                },
                config = JsonSerializer.Deserialize<JsonElement>(item.Config)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding item to dashboard {DashboardId}", id);
            return StatusCode(500, new { message = "Error adding item" });
        }
    }

    // PUT: api/dashboard/{id}/items/{itemId}/layout
    [HttpPut("{id}/items/{itemId}/layout")]
    public async Task<IActionResult> UpdateItemLayout(int id, int itemId, [FromBody] LayoutDto layout)
    {
        try
        {
            var item = await _context.DashboardItems
                .Include(i => i.Tab)
                .Where(i => i.Id == itemId && i.Tab.DashboardId == id && !i.IsDeleted)
                .FirstOrDefaultAsync();

            if (item == null)
            {
                return NotFound(new { message = "Item not found" });
            }

            item.LayoutX = layout.X;
            item.LayoutY = layout.Y;
            item.LayoutW = layout.W;
            item.LayoutH = layout.H;

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating item layout for dashboard {DashboardId}", id);
            return StatusCode(500, new { message = "Error updating item layout" });
        }
    }

    // DELETE: api/dashboard/{id}/items/{itemId}
    [HttpDelete("{id}/items/{itemId}")]
    public async Task<IActionResult> DeleteItem(int id, int itemId)
    {
        try
        {
            var item = await _context.DashboardItems
                .Include(i => i.Tab)
                .Where(i => i.Id == itemId && i.Tab.DashboardId == id && !i.IsDeleted)
                .FirstOrDefaultAsync();

            if (item == null)
            {
                return NotFound(new { message = "Item not found" });
            }

            item.IsDeleted = true;
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting item from dashboard {DashboardId}", id);
            return StatusCode(500, new { message = "Error deleting item" });
        }
    }

    // POST: api/dashboard/radius-data
    [HttpPost("radius-data")]
    public async Task<ActionResult<object>> GetRadiusDashboardData([FromBody] RadiusDashboardDataRequest request)
    {
        try
        {
            IQueryable<RadiusUser> query = _context.RadiusUsers
                .Include(r => r.Profile)
                .Include(r => r.RadiusUserTags)
                    .ThenInclude(rut => rut.RadiusTag)
                .Where(r => !r.IsDeleted);

            // Apply filters if provided
            if (request.FilterGroup != null && request.FilterGroup.Conditions.Any())
            {
                query = ApplyRadiusFilters(query, request.FilterGroup);
            }

            // Disaggregate and aggregate data
            if (!string.IsNullOrEmpty(request.DisaggregationField))
            {
                var results = await GetDisaggregatedData(query, request);
                return Ok(results);
            }
            else
            {
                // No disaggregation - return single aggregated value
                var value = await GetAggregatedValue(query, request);
                return Ok(new { value });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting RADIUS dashboard data");
            return StatusCode(500, new { message = "Error retrieving dashboard data" });
        }
    }

    private IQueryable<RadiusUser> ApplyRadiusFilters(IQueryable<RadiusUser> query, FilterGroupDto filterGroup)
    {
        foreach (var condition in filterGroup.Conditions)
        {
            var columnLower = condition.Column.ToLower();
            
            switch (columnLower)
            {
                case "profileid":
                case "profile":
                    if (condition.Value != null && condition.Value.Value.ValueKind == JsonValueKind.String)
                    {
                        var profileIds = condition.Value.Value.GetString()?.Split(',')
                            .Select(id => int.TryParse(id.Trim(), out var pid) ? pid : 0)
                            .Where(id => id > 0)
                            .ToList();

                        if (profileIds != null && profileIds.Any())
                        {
                            query = query.Where(r => r.ProfileId != null && profileIds.Contains(r.ProfileId.Value));
                        }
                    }
                    break;

                case "username":
                    if (condition.Value != null && condition.Value.Value.ValueKind == JsonValueKind.String)
                    {
                        var value = condition.Value.Value.GetString();
                        if (!string.IsNullOrEmpty(value))
                        {
                            if (condition.Operator == "contains")
                                query = query.Where(r => r.Username != null && r.Username.Contains(value));
                            else if (condition.Operator == "equals")
                                query = query.Where(r => r.Username == value);
                        }
                    }
                    break;

                case "balance":
                    if (condition.Value != null)
                    {
                        var value = GetNumericValue(condition.Value.Value);
                        if (value.HasValue)
                        {
                            if (condition.Operator == "greater_than")
                                query = query.Where(r => r.Balance > value.Value);
                            else if (condition.Operator == "less_than")
                                query = query.Where(r => r.Balance < value.Value);
                            else if (condition.Operator == "equals")
                                query = query.Where(r => r.Balance == value.Value);
                        }
                    }
                    break;

                case "status":
                    if (condition.Value != null && condition.Value.Value.ValueKind == JsonValueKind.String)
                    {
                        var value = condition.Value.Value.GetString();
                        var enabled = value == "active";
                        query = query.Where(r => r.Enabled == enabled);
                    }
                    break;
            }
        }

        return query;
    }

    private async Task<object> GetDisaggregatedData(IQueryable<RadiusUser> query, RadiusDashboardDataRequest request)
    {
        var field = request.DisaggregationField!.ToLower();

        switch (field)
        {
            case "profileid":
            case "profile":
                var byProfile = await query
                    .GroupBy(r => r.Profile != null ? r.Profile.Name : "No Profile")
                    .Select(g => new
                    {
                        name = g.Key,
                        value = request.AggregationType == "count" ? g.Count() :
                               request.AggregationType == "sum" && !string.IsNullOrEmpty(request.ValueField) ?
                               GetGroupSum(g, request.ValueField) :
                               request.AggregationType == "avg" && !string.IsNullOrEmpty(request.ValueField) ?
                               GetGroupAvg(g, request.ValueField) : g.Count()
                    })
                    .ToListAsync();
                return byProfile;

            case "status":
                var byStatus = await query
                    .GroupBy(r => r.Enabled)
                    .Select(g => new
                    {
                        name = g.Key ? "Active" : "Inactive",
                        value = request.AggregationType == "count" ? g.Count() :
                               request.AggregationType == "sum" && !string.IsNullOrEmpty(request.ValueField) ?
                               GetGroupSum(g, request.ValueField) :
                               request.AggregationType == "avg" && !string.IsNullOrEmpty(request.ValueField) ?
                               GetGroupAvg(g, request.ValueField) : g.Count()
                    })
                    .ToListAsync();
                return byStatus;

            case "tags":
                var byTags = await query
                    .SelectMany(r => r.RadiusUserTags.Select(rut => new { User = r, Tag = rut.RadiusTag }))
                    .GroupBy(x => x.Tag.Title)
                    .Select(g => new
                    {
                        name = g.Key,
                        value = g.Count()
                    })
                    .ToListAsync();
                return byTags;

            default:
                return new List<object>();
        }
    }

    private async Task<int> GetAggregatedValue(IQueryable<RadiusUser> query, RadiusDashboardDataRequest request)
    {
        if (request.AggregationType == "count")
        {
            return await query.CountAsync();
        }
        else if (request.AggregationType == "sum" && request.ValueField == "balance")
        {
            return (int)await query.SumAsync(r => r.Balance);
        }
        else if (request.AggregationType == "avg" && request.ValueField == "balance")
        {
            var avg = await query.AverageAsync(r => (double?)r.Balance);
            return (int)(avg ?? 0);
        }

        return await query.CountAsync();
    }

    private decimal? GetNumericValue(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Number)
            return element.GetDecimal();
        if (element.ValueKind == JsonValueKind.String)
        {
            var str = element.GetString();
            if (decimal.TryParse(str, out var result))
                return result;
        }
        return null;
    }

    private double GetGroupSum(IGrouping<string, RadiusUser> group, string field)
    {
        if (field.ToLower() == "balance")
            return (double)group.Sum(r => r.Balance);
        return 0;
    }

    private double GetGroupAvg(IGrouping<string, RadiusUser> group, string field)
    {
        if (field.ToLower() == "balance")
            return (double)group.Average(r => (decimal?)r.Balance ?? 0);
        return 0;
    }

    private double GetGroupSum(IGrouping<bool, RadiusUser> group, string field)
    {
        if (field.ToLower() == "balance")
            return (double)group.Sum(r => r.Balance);
        return 0;
    }

    private double GetGroupAvg(IGrouping<bool, RadiusUser> group, string field)
    {
        if (field.ToLower() == "balance")
            return (double)group.Average(r => (decimal?)r.Balance ?? 0);
        return 0;
    }
}

// DTOs
public class CreateDashboardDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Icon { get; set; } = "LayoutDashboard";
    public string Color { get; set; } = "#3b82f6";
    public List<TabDto>? Tabs { get; set; }
}

public class UpdateDashboardDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public List<TabDto>? Tabs { get; set; }
    public List<GlobalFilterDto>? GlobalFilters { get; set; }
}

public class TabDto
{
    public string Name { get; set; } = string.Empty;
}

public class GlobalFilterDto
{
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public object? Value { get; set; }
    public object? Options { get; set; }
}

public class AddItemDto
{
    public int TabId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public LayoutDto Layout { get; set; } = new();
    public object Config { get; set; } = new { };
}

public class LayoutDto
{
    public int X { get; set; }
    public int Y { get; set; }
    public int W { get; set; }
    public int H { get; set; }
}

public class RadiusDashboardDataRequest
{
    public string? DisaggregationField { get; set; }
    public string AggregationType { get; set; } = "count";
    public string? ValueField { get; set; }
    public FilterGroupDto? FilterGroup { get; set; }
}

public class FilterGroupDto
{
    public string Id { get; set; } = string.Empty;
    public string Logic { get; set; } = "and";
    public List<FilterConditionDto> Conditions { get; set; } = new();
}

public class FilterConditionDto
{
    public string Id { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public string Column { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;
    public JsonElement? Value { get; set; }
    public JsonElement? Value2 { get; set; }
}
