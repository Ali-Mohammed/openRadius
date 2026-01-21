using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Backend.Services;

public class MicroserviceApprovalService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MicroserviceApprovalService> _logger;

    public MicroserviceApprovalService(ApplicationDbContext context, ILogger<MicroserviceApprovalService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Validates if a microservice with the given machine ID and token is approved
    /// </summary>
    public async Task<bool> ValidateConnectionAsync(string serviceName, string machineId, string token)
    {
        var approval = await _context.MicroserviceApprovals
            .FirstOrDefaultAsync(a => 
                a.ServiceName == serviceName && 
                a.MachineId == machineId && 
                a.ApprovalToken == token &&
                a.IsApproved && 
                !a.IsRevoked);

        if (approval != null)
        {
            approval.LastConnectedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }

    /// <summary>
    /// Requests approval for a new microservice connection
    /// </summary>
    public async Task<string> RequestApprovalAsync(string serviceName, string machineId, string machineName, string platform)
    {
        // Check if already exists
        var existing = await _context.MicroserviceApprovals
            .FirstOrDefaultAsync(a => a.ServiceName == serviceName && a.MachineId == machineId);

        if (existing != null)
        {
            if (existing.IsApproved && !existing.IsRevoked)
            {
                return existing.ApprovalToken;
            }
            
            // Return existing token for pending approval
            if (!existing.IsApproved)
            {
                return existing.ApprovalToken;
            }
        }

        // Generate new approval token
        var token = GenerateSecureToken(machineId, serviceName);

        var approval = new MicroserviceApproval
        {
            ServiceName = serviceName,
            MachineId = machineId,
            MachineName = machineName,
            Platform = platform,
            ApprovalToken = token,
            IsApproved = false,
            LastConnectedAt = DateTime.UtcNow
        };

        _context.MicroserviceApprovals.Add(approval);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Approval requested for {ServiceName} from machine {MachineId}", serviceName, machineId);

        return token;
    }

    /// <summary>
    /// Approves a microservice connection
    /// </summary>
    public async Task<bool> ApproveConnectionAsync(int approvalId, string approvedBy)
    {
        var approval = await _context.MicroserviceApprovals.FindAsync(approvalId);
        if (approval == null) return false;

        approval.IsApproved = true;
        approval.ApprovedAt = DateTime.UtcNow;
        approval.ApprovedBy = approvedBy;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Approved connection for {ServiceName} from machine {MachineId} by {ApprovedBy}", 
            approval.ServiceName, approval.MachineId, approvedBy);

        return true;
    }

    /// <summary>
    /// Revokes a microservice connection
    /// </summary>
    public async Task<bool> RevokeConnectionAsync(int approvalId)
    {
        var approval = await _context.MicroserviceApprovals.FindAsync(approvalId);
        if (approval == null) return false;

        approval.IsRevoked = true;
        approval.RevokedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Revoked connection for {ServiceName} from machine {MachineId}", 
            approval.ServiceName, approval.MachineId);

        return true;
    }

    /// <summary>
    /// Deletes a microservice approval - service will appear as pending again on next connection
    /// </summary>
    public async Task<bool> DeleteApprovalAsync(int approvalId)
    {
        var approval = await _context.MicroserviceApprovals.FindAsync(approvalId);
        if (approval == null) return false;

        _context.MicroserviceApprovals.Remove(approval);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted approval for {ServiceName} from machine {MachineId}", 
            approval.ServiceName, approval.MachineId);

        return true;
    }

    /// <summary>
    /// Gets all pending approval requests
    /// </summary>
    public async Task<List<MicroserviceApproval>> GetPendingApprovalsAsync()
    {
        return await _context.MicroserviceApprovals
            .Where(a => !a.IsApproved && !a.IsRevoked)
            .OrderByDescending(a => a.LastConnectedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Gets all approved connections
    /// </summary>
    public async Task<List<MicroserviceApproval>> GetApprovedConnectionsAsync()
    {
        return await _context.MicroserviceApprovals
            .Where(a => a.IsApproved && !a.IsRevoked)
            .OrderByDescending(a => a.LastConnectedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Gets approval by service name and machine ID
    /// </summary>
    public async Task<MicroserviceApproval?> GetApprovalByMachineAsync(string serviceName, string machineId)
    {
        return await _context.MicroserviceApprovals
            .FirstOrDefaultAsync(a => a.ServiceName == serviceName && a.MachineId == machineId);
    }

    /// <summary>
    /// Updates the last connected time for an approval
    /// </summary>
    public async Task UpdateLastConnectedAsync(string serviceName, string machineId)
    {
        var approval = await _context.MicroserviceApprovals
            .FirstOrDefaultAsync(a => a.ServiceName == serviceName && a.MachineId == machineId);

        if (approval != null)
        {
            approval.LastConnectedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Generates a secure token based on machine ID and service name
    /// </summary>
    private string GenerateSecureToken(string machineId, string serviceName)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes($"{machineId}{serviceName}{DateTime.UtcNow.Ticks}"));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{machineId}:{serviceName}:{Guid.NewGuid()}"));
        return Convert.ToBase64String(hash);
    }
}
