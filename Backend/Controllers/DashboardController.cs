using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{workspaceId}/[controller]")]
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

    // GET: api/workspaces/{workspaceId}/dashboard
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetDashboards(int workspaceId)
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
            _logger.LogError(ex, "Error getting dashboards for workspace {WorkspaceId}", workspaceId);
            return StatusCode(500, new { message = "Error retrieving dashboards" });
        }
    }

    // GET: api/workspaces/{workspaceId}/dashboard/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetDashboard(int workspaceId, int id)
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
            _logger.LogError(ex, "Error getting dashboard {DashboardId} for workspace {WorkspaceId}", id, workspaceId);
            return StatusCode(500, new { message = "Error retrieving dashboard" });
        }
    }

    // POST: api/workspaces/{workspaceId}/dashboard
    [HttpPost]
    public async Task<ActionResult<object>> CreateDashboard(int workspaceId, [FromBody] CreateDashboardDto dto)
    {
        try
        {
            var dashboard = new Dashboard
            {
                Name = dto.Name,
                Description = dto.Description,
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
                new { workspaceId, id = dashboard.Id },
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
            _logger.LogError(ex, "Error creating dashboard for workspace {WorkspaceId}", workspaceId);
            return StatusCode(500, new { message = "Error creating dashboard" });
        }
    }

    // PUT: api/workspaces/{workspaceId}/dashboard/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDashboard(int workspaceId, int id, [FromBody] UpdateDashboardDto dto)
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
            _logger.LogError(ex, "Error updating dashboard {DashboardId} for workspace {WorkspaceId}", id, workspaceId);
            return StatusCode(500, new { message = "Error updating dashboard" });
        }
    }

    // DELETE: api/workspaces/{workspaceId}/dashboard/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDashboard(int workspaceId, int id)
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
            _logger.LogError(ex, "Error deleting dashboard {DashboardId} for workspace {WorkspaceId}", id, workspaceId);
            return StatusCode(500, new { message = "Error deleting dashboard" });
        }
    }

    // POST: api/workspaces/{workspaceId}/dashboard/{id}/items
    [HttpPost("{id}/items")]
    public async Task<ActionResult<object>> AddItem(int workspaceId, int id, [FromBody] AddItemDto dto)
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

    // PUT: api/workspaces/{workspaceId}/dashboard/{id}/items/{itemId}/layout
    [HttpPut("{id}/items/{itemId}/layout")]
    public async Task<IActionResult> UpdateItemLayout(int workspaceId, int id, int itemId, [FromBody] LayoutDto layout)
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

    // DELETE: api/workspaces/{workspaceId}/dashboard/{id}/items/{itemId}
    [HttpDelete("{id}/items/{itemId}")]
    public async Task<IActionResult> DeleteItem(int workspaceId, int id, int itemId)
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
}

// DTOs
public class CreateDashboardDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<TabDto>? Tabs { get; set; }
}

public class UpdateDashboardDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
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
