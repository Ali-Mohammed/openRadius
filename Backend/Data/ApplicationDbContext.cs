using Microsoft.EntityFrameworkCore;
using Backend.Models;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Finbuckle.MultiTenant.EntityFrameworkCore;

namespace Backend.Data;

/// <summary>
/// Workspace-specific database context for multi-tenant data.
/// Each workspace has its own database containing RadiusUsers, RadiusProfiles, 
/// SasRadiusIntegration, and SyncProgress data.
/// </summary>
public class ApplicationDbContext : DbContext
{
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo>? _multiTenantContextAccessor;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options, 
        IMultiTenantContextAccessor<WorkspaceTenantInfo>? multiTenantContextAccessor = null)
        : base(options)
    {
        _multiTenantContextAccessor = multiTenantContextAccessor;
    }

    public DbSet<RadiusUser> RadiusUsers { get; set; }
    public DbSet<RadiusProfile> RadiusProfiles { get; set; }
    public DbSet<SasRadiusIntegration> SasRadiusIntegrations { get; set; }
    public DbSet<SyncProgress> SyncProgresses { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<RadiusUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.HasOne(e => e.Profile)
                  .WithMany()
                  .HasForeignKey(e => e.ProfileId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}

