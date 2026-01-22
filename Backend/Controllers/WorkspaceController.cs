using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Finbuckle.MultiTenant.Abstractions;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkspaceController : ControllerBase
{
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<WorkspaceController> _logger;
    private readonly IConfiguration _configuration;

    public WorkspaceController(
        MasterDbContext masterContext, 
        ILogger<WorkspaceController> logger,
        IConfiguration configuration)
    {
        _masterContext = masterContext;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Workspace>>> GetWorkspaces(
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortOrder = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var query = _masterContext.Workspaces.AsQueryable();

        // Filter out soft-deleted items by default
        if (!includeDeleted)
        {
            query = query.Where(i => i.DeletedAt == null);
        }

        // Search functionality
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(i => 
                i.Title.Contains(search) ||
                i.Name.Contains(search) ||
                i.Location.Contains(search) ||
                i.Description.Contains(search));
        }

        // Sorting
        if (!string.IsNullOrWhiteSpace(sortBy))
        {
            query = sortBy.ToLower() switch
            {
                "title" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Title) 
                    : query.OrderBy(i => i.Title),
                "name" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Name) 
                    : query.OrderBy(i => i.Name),
                "location" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Location) 
                    : query.OrderBy(i => i.Location),
                "status" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Status) 
                    : query.OrderBy(i => i.Status),
                "createdat" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.CreatedAt) 
                    : query.OrderBy(i => i.CreatedAt),
                _ => query.OrderByDescending(i => i.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(i => i.CreatedAt);
        }

        var workspaces = await query.ToListAsync();
        
        // Return DTOs to avoid circular references
        var workspaceResponses = workspaces.Select(w => new
        {
            w.Id,
            w.Title,
            w.Name,
            w.Location,
            w.Description,
            w.Comments,
            w.Status,
            w.Color,
            w.Icon,
            w.Currency,
            w.CreatedAt,
            w.UpdatedAt,
            w.CreatedBy,
            w.UpdatedBy,
            w.DeletedAt,
            w.DeletedBy
        }).ToList();
        
        return Ok(workspaceResponses);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Workspace>> GetWorkspace(int id)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(id);

        if (workspace == null)
        {
            return NotFound();
        }

        return workspace;
    }

    [HttpPost]
    public async Task<ActionResult<Workspace>> CreateWorkspace(WorkspaceDto dto)
    {
        var workspace = new Workspace
        {
            Title = dto.Title,
            Name = dto.Name,
            Location = dto.Location,
            Description = dto.Description,
            Comments = dto.Comments,
            Status = dto.Status,
            Color = dto.Color,
            Icon = dto.Icon,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = User.GetSystemUserId(),
            UpdatedBy = User.GetSystemUserId()
        };
        
        _masterContext.Workspaces.Add(workspace);
        await _masterContext.SaveChangesAsync();

        // Create a dedicated database for this workspace/tenant
        try
        {
            var tenantConnectionString = GetTenantConnectionString(workspace.Id);
            
            var tenantInfo = new WorkspaceTenantInfo
            {
                Id = workspace.Id.ToString(),
                Identifier = workspace.Name,
                Name = workspace.Title,
                ConnectionString = tenantConnectionString,
                WorkspaceId = workspace.Id,
                DisplayName = workspace.Title,
                Location = workspace.Location,
                IsActive = workspace.Status == "active"
            };
            
            var tenantDbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(tenantInfo.ConnectionString)
                .Options;
                
            using var tenantContext = new ApplicationDbContext(tenantDbContextOptions);
            
            // Ensure the database is dropped if it exists (to prevent dirty state from previous failed attempts)
            var canConnect = await tenantContext.Database.CanConnectAsync();
            if (canConnect)
            {
                _logger.LogWarning($"⚠ Tenant database already exists for workspace {workspace.Title}, dropping it to ensure clean state");
                await tenantContext.Database.EnsureDeletedAsync();
            }
            
            // Create fresh database with migrations
            await tenantContext.Database.MigrateAsync();
            
            // Seed default RADIUS tags
            await SeedDefaultRadiusTags(tenantContext);
            
            // Seed default custom wallets
            await SeedDefaultCustomWallets(tenantContext);
            
            _logger.LogInformation($"✓ Created tenant database for workspace: {workspace.Title} (ID: {workspace.Id})");
        }
        catch (Exception ex)
        {
            _logger.LogError($"✗ Failed to create tenant database for workspace {workspace.Title}: {ex.Message}");
            
            // Rollback the workspace creation
            _masterContext.Workspaces.Remove(workspace);
            await _masterContext.SaveChangesAsync();
            
            return StatusCode(500, new { message = "Failed to create tenant database", error = ex.Message });
        }

        return CreatedAtAction(nameof(GetWorkspace), new { id = workspace.Id }, workspace);
    }

    private string GetTenantConnectionString(int WorkspaceId)
    {
        var baseConnectionString = _configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        var parts = baseConnectionString.Split(';');
        var newParts = new List<string>();
        
        foreach (var part in parts)
        {
            if (part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase))
            {
                newParts.Add($"Database=openradius_workspace_{WorkspaceId}");
            }
            else
            {
                newParts.Add(part);
            }
        }
        
        return string.Join(";", newParts);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateWorkspace(int id, WorkspaceDto dto)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(id);
        if (workspace == null || workspace.DeletedAt != null)
        {
            return NotFound();
        }

        workspace.Title = dto.Title;
        workspace.Name = dto.Name;
        workspace.Location = dto.Location;
        workspace.Description = dto.Description;
        workspace.Comments = dto.Comments;
        workspace.Status = dto.Status;
        workspace.Color = dto.Color;
        workspace.Icon = dto.Icon;
        workspace.UpdatedAt = DateTime.UtcNow;
        workspace.UpdatedBy = User.GetSystemUserId();

        try
        {
            await _masterContext.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!WorkspaceExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkspace(int id)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(id);
        if (workspace == null || workspace.DeletedAt != null)
        {
            return NotFound();
        }

        workspace.DeletedAt = DateTime.UtcNow;
        workspace.DeletedBy = User.GetSystemUserId();
        await _masterContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreWorkspace(int id)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(id);
        if (workspace == null)
        {
            return NotFound();
        }

        if (workspace.DeletedAt == null)
        {
            return BadRequest("Workspace is not deleted");
        }

        workspace.DeletedAt = null;
        workspace.DeletedBy = null;
        workspace.UpdatedAt = DateTime.UtcNow;
        workspace.UpdatedBy = User.GetSystemUserId();
        await _masterContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("deleted")]
    public async Task<ActionResult<IEnumerable<Workspace>>> GetDeletedWorkspaces()
    {
        var query = _masterContext.Workspaces
            .Where(i => i.DeletedAt != null)
            .OrderByDescending(i => i.DeletedAt);

        return await query.ToListAsync();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportToExcel()
    {
        var workspaces = await _masterContext.Workspaces.OrderByDescending(i => i.CreatedAt).ToListAsync();
        
        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Workspaces");
        
        // Headers
        worksheet.Cell(1, 1).Value = "ID";
        worksheet.Cell(1, 2).Value = "Title";
        worksheet.Cell(1, 3).Value = "Name";
        worksheet.Cell(1, 4).Value = "Location";
        worksheet.Cell(1, 5).Value = "Description";
        worksheet.Cell(1, 6).Value = "Comments";
        worksheet.Cell(1, 7).Value = "Status";
        worksheet.Cell(1, 8).Value = "Color";
        worksheet.Cell(1, 9).Value = "Created At";
        worksheet.Cell(1, 10).Value = "Created By";
        worksheet.Cell(1, 11).Value = "Updated At";
        worksheet.Cell(1, 12).Value = "Updated By";
        worksheet.Cell(1, 13).Value = "Deleted At";
        worksheet.Cell(1, 14).Value = "Deleted By";
        
        // Style headers
        var headerRange = worksheet.Range(1, 1, 1, 14);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;
        
        // Data
        for (int i = 0; i < workspaces.Count; i++)
        {
            var workspace = workspaces[i];
            var row = i + 2;
            
            worksheet.Cell(row, 1).Value = workspace.Id;
            worksheet.Cell(row, 2).Value = workspace.Title;
            worksheet.Cell(row, 3).Value = workspace.Name;
            worksheet.Cell(row, 4).Value = workspace.Location;
            worksheet.Cell(row, 5).Value = workspace.Description;
            worksheet.Cell(row, 6).Value = workspace.Comments;
            worksheet.Cell(row, 7).Value = workspace.Status;
            worksheet.Cell(row, 8).Value = workspace.Color;
            worksheet.Cell(row, 9).Value = workspace.CreatedAt;
            worksheet.Cell(row, 10).Value = workspace.CreatedBy;
            worksheet.Cell(row, 11).Value = workspace.UpdatedAt;
            worksheet.Cell(row, 12).Value = workspace.UpdatedBy;
            worksheet.Cell(row, 13).Value = workspace.DeletedAt?.ToString() ?? "";
            worksheet.Cell(row, 14).Value = workspace.DeletedBy ?? "";
        }
        
        // Auto-fit columns
        worksheet.Columns().AdjustToContents();
        
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        
        return File(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"workspaces_{DateTime.UtcNow:yyyy-MM-dd}.xlsx"
        );
    }

    [HttpGet("export-json")]
    public async Task<IActionResult> ExportToJson()
    {
        var workspaces = await _masterContext.Workspaces
            .Where(w => w.DeletedAt == null)
            .OrderByDescending(i => i.CreatedAt)
            .Select(w => new
            {
                w.Title,
                w.Name,
                w.Location,
                w.Description,
                w.Comments,
                w.Status,
                w.Color,
                w.Icon,
                w.Currency
            })
            .ToListAsync();
        
        var json = System.Text.Json.JsonSerializer.Serialize(workspaces, new System.Text.Json.JsonSerializerOptions 
        { 
            WriteIndented = true 
        });
        
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);
        
        return File(
            bytes,
            "application/json",
            $"workspaces_{DateTime.UtcNow:yyyy-MM-dd}.json"
        );
    }

    [HttpPost("import-json")]
    public async Task<IActionResult> ImportFromJson(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file uploaded" });
        }

        if (!file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "File must be a JSON file" });
        }

        try
        {
            using var stream = new StreamReader(file.OpenReadStream());
            var json = await stream.ReadToEndAsync();
            
            var workspaceDtos = System.Text.Json.JsonSerializer.Deserialize<List<WorkspaceImportDto>>(json, new System.Text.Json.JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (workspaceDtos == null || workspaceDtos.Count == 0)
            {
                return BadRequest(new { message = "No workspaces found in file" });
            }

            var userName = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value ?? "Unknown";
            var imported = 0;
            var skipped = 0;
            var errors = new List<string>();

            foreach (var dto in workspaceDtos)
            {
                // Check if workspace with same name already exists
                var exists = await _masterContext.Workspaces.AnyAsync(w => w.Name == dto.Name && w.DeletedAt == null);
                if (exists)
                {
                    skipped++;
                    errors.Add($"Workspace '{dto.Name}' already exists");
                    continue;
                }

                var workspace = new Workspace
                {
                    Title = dto.Title ?? dto.Name,
                    Name = dto.Name,
                    Location = dto.Location ?? "",
                    Description = dto.Description ?? "",
                    Comments = dto.Comments ?? "",
                    Status = dto.Status ?? "active",
                    Color = dto.Color ?? "#3b82f6",
                    Icon = dto.Icon ?? "Building2",
                    Currency = dto.Currency ?? "USD",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedBy = userName,
                    UpdatedBy = userName
                };

                _masterContext.Workspaces.Add(workspace);
                await _masterContext.SaveChangesAsync();

                // Create tenant database
                try
                {
                    var tenantConnectionString = GetTenantConnectionString(workspace.Id);
                    var tenantDbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                        .UseNpgsql(tenantConnectionString)
                        .Options;
                    
                    using var tenantContext = new ApplicationDbContext(tenantDbContextOptions);
                    await tenantContext.Database.MigrateAsync();
                    await SeedDefaultRadiusTags(tenantContext);
                    await SeedDefaultCustomWallets(tenantContext);
                    
                    imported++;
                    _logger.LogInformation($"✓ Imported workspace: {workspace.Title} (ID: {workspace.Id})");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"✗ Failed to create tenant database for imported workspace {workspace.Title}: {ex.Message}");
                    _masterContext.Workspaces.Remove(workspace);
                    await _masterContext.SaveChangesAsync();
                    errors.Add($"Failed to create database for '{dto.Name}': {ex.Message}");
                }
            }

            return Ok(new 
            { 
                message = $"Import completed: {imported} imported, {skipped} skipped",
                imported,
                skipped,
                errors
            });
        }
        catch (System.Text.Json.JsonException ex)
        {
            return BadRequest(new { message = "Invalid JSON format", error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Import failed: {ex.Message}");
            return StatusCode(500, new { message = "Import failed", error = ex.Message });
        }
    }

    private async Task SeedDefaultRadiusTags(ApplicationDbContext context)
    {
        // Check if tags already exist
        if (await context.RadiusTags.AnyAsync())
        {
            return;
        }

        var defaultTags = new List<RadiusTag>
        {
            new RadiusTag { Title = "Active", Description = "User account is active", Color = "#22c55e", Icon = "CheckCircle", Status = "active" },
            new RadiusTag { Title = "Expired", Description = "Account has expired", Color = "#ef4444", Icon = "XCircle", Status = "active" },
            new RadiusTag { Title = "Churn", Description = "Customer has churned", Color = "#dc2626", Icon = "UserX", Status = "active" },
            new RadiusTag { Title = "Churn Risk", Description = "At risk of churning", Color = "#f59e0b", Icon = "AlertTriangle", Status = "active" },
            new RadiusTag { Title = "Static IP", Description = "Has static IP assignment", Color = "#3b82f6", Icon = "Network", Status = "active" },
            new RadiusTag { Title = "Power Issue", Description = "Power-related problems", Color = "#f97316", Icon = "Zap", Status = "active" },
            new RadiusTag { Title = "Open Ticket", Description = "Has open support ticket", Color = "#8b5cf6", Icon = "Ticket", Status = "active" },
            new RadiusTag { Title = "High Usage", Description = "High bandwidth usage", Color = "#ec4899", Icon = "TrendingUp", Status = "active" },
            new RadiusTag { Title = "Heavy Usage", Description = "Excessive bandwidth consumption", Color = "#be123c", Icon = "Activity", Status = "active" },
            new RadiusTag { Title = "Offline 24h+", Description = "Offline for more than 24 hours", Color = "#64748b", Icon = "WifiOff", Status = "active" },
            new RadiusTag { Title = "VIP", Description = "VIP customer", Color = "#eab308", Icon = "Crown", Status = "active" },
            new RadiusTag { Title = "New Customer", Description = "Recently joined", Color = "#06b6d4", Icon = "UserPlus", Status = "active" },
            new RadiusTag { Title = "Suspended", Description = "Account suspended", Color = "#71717a", Icon = "Ban", Status = "active" },
            new RadiusTag { Title = "Payment Issue", Description = "Payment problems", Color = "#dc2626", Icon = "CreditCard", Status = "active" },
            new RadiusTag { Title = "Technical Issue", Description = "Technical problems reported", Color = "#f97316", Icon = "Wrench", Status = "active" },
            new RadiusTag { Title = "Scheduled Maintenance", Description = "Under maintenance", Color = "#14b8a6", Icon = "Clock", Status = "active" },
            new RadiusTag { Title = "Monitor", Description = "Requires monitoring", Color = "#a855f7", Icon = "Eye", Status = "active" },
            new RadiusTag { Title = "Beta Tester", Description = "Testing new features", Color = "#10b981", Icon = "FlaskConical", Status = "active" }
        };

        context.RadiusTags.AddRange(defaultTags);
        await context.SaveChangesAsync();
        
        _logger.LogInformation($"✓ Seeded {defaultTags.Count} default RADIUS tags");
    }

    private async Task SeedDefaultCustomWallets(ApplicationDbContext context)
    {
        // Check if wallets already exist
        if (await context.CustomWallets.AnyAsync())
        {
            return;
        }

        var defaultWallets = new List<CustomWallet>
        {
            new CustomWallet 
            { 
                Name = "Company Master Account", 
                Description = "Main company account for overall funds management",
                Type = "collection",
                Status = "active",
                Color = "#06b6d4",
                Icon = "Wallet",
                MaxFillLimit = 0,
                DailySpendingLimit = 0,
                CurrentBalance = 0,
                AllowNegativeBalance = false,
                SortOrder = 1,
                CreatedAt = DateTime.UtcNow
            },
            new CustomWallet 
            { 
                Name = "Partner Revenue Wallet", 
                Description = "Collection wallet for partner revenue payments",
                Type = "collection",
                Status = "active",
                Color = "#8b5cf6",
                Icon = "Building2",
                MaxFillLimit = 0,
                DailySpendingLimit = 0,
                CurrentBalance = 0,
                AllowNegativeBalance = false,
                SortOrder = 2,
                CreatedAt = DateTime.UtcNow
            },
            new CustomWallet 
            { 
                Name = "Marketing Wallet", 
                Description = "Credit wallet for marketing campaigns",
                Type = "credit",
                Status = "active",
                Color = "#f59e0b",
                Icon = "Megaphone",
                MaxFillLimit = 0,
                DailySpendingLimit = 0,
                CurrentBalance = 0,
                AllowNegativeBalance = false,
                SortOrder = 3,
                CreatedAt = DateTime.UtcNow
            }
        };

        context.CustomWallets.AddRange(defaultWallets);
        await context.SaveChangesAsync();
        
        _logger.LogInformation($"✓ Seeded {defaultWallets.Count} default custom wallets");
    }

    private bool WorkspaceExists(int id)
    {
        return _masterContext.Workspaces.Any(e => e.Id == id);
    }
}


