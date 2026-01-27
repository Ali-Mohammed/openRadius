using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

/// <summary>
/// Example background job service for workspace-specific tasks
/// </summary>
public interface IExampleJobService
{
    Task ProcessDataCleanupAsync();
    Task GenerateReportAsync(int reportId);
    Task SyncExternalDataAsync();
}

public class ExampleJobService : IExampleJobService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ExampleJobService> _logger;
    
    public ExampleJobService(
        ApplicationDbContext context,
        ILogger<ExampleJobService> logger)
    {
        _context = context;
        _logger = logger;
    }
    
    /// <summary>
    /// Example: Clean up old data for the workspace
    /// </summary>
    public async Task ProcessDataCleanupAsync()
    {
        _logger.LogInformation("Starting data cleanup job for workspace");
        
        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-90);
            
            // Example: Delete old payment transactions (soft delete)
            var oldTransactions = await _context.Transactions
                .Where(t => t.CreatedAt < cutoffDate && t.DeletedAt == null)
                .ToListAsync();
            
            if (oldTransactions.Any())
            {
                foreach (var transaction in oldTransactions)
                {
                    transaction.DeletedAt = DateTime.UtcNow;
                }
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Soft deleted {oldTransactions.Count} old transactions");
            }
            
            _logger.LogInformation("Data cleanup job completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during data cleanup job");
            throw;
        }
    }
    
    /// <summary>
    /// Example: Generate a report in the background
    /// </summary>
    public async Task GenerateReportAsync(int reportId)
    {
        _logger.LogInformation($"Starting report generation job for report ID: {reportId}");
        
        try
        {
            // Add your report generation logic here
            await Task.Delay(1000); // Simulate work
            
            _logger.LogInformation($"Report {reportId} generated successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error generating report {reportId}");
            throw;
        }
    }
    
    /// <summary>
    /// Example: Sync data from external systems
    /// </summary>
    public async Task SyncExternalDataAsync()
    {
        _logger.LogInformation("Starting external data sync job");
        
        try
        {
            // Add your sync logic here
            await Task.Delay(1000); // Simulate work
            
            _logger.LogInformation("External data sync completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during external data sync");
            throw;
        }
    }
}
