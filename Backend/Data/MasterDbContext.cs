using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

/// <summary>
/// Master database context for managing tenants (Workspaces).
/// This context stores the list of all Workspaces, Users, and global OIDC settings.
/// </summary>
public class MasterDbContext : DbContext
{
    public MasterDbContext(DbContextOptions<MasterDbContext> options)
        : base(options)
    {
    }

    public DbSet<Workspace> Workspaces { get; set; }
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

