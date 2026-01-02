using Microsoft.EntityFrameworkCore;
using Backend.Models;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Finbuckle.MultiTenant.EntityFrameworkCore;

namespace Backend.Data;

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

    public DbSet<User> Users { get; set; }
    public DbSet<OidcSettings> OidcSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.Email).IsUnique();
            
            // Configure relationships for multi-tenant workspace selection
            entity.HasOne(e => e.DefaultWorkspace)
                  .WithMany()
                  .HasForeignKey(e => e.DefaultWorkspaceId)
                  .OnDelete(DeleteBehavior.SetNull);
                  
            entity.HasOne(e => e.CurrentWorkspace)
                  .WithMany()
                  .HasForeignKey(e => e.CurrentWorkspaceId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}

