using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

/// <summary>
/// Master database context for managing tenants (Instants).
/// This context stores the list of all Instants and their connection strings.
/// </summary>
public class MasterDbContext : DbContext
{
    public MasterDbContext(DbContextOptions<MasterDbContext> options)
        : base(options)
    {
    }

    public DbSet<Instant> Instants { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<OidcSettings> OidcSettings { get; set; }
    public DbSet<SasRadiusIntegration> SasRadiusIntegrations { get; set; }
    public DbSet<RadiusProfile> RadiusProfiles { get; set; }
    public DbSet<RadiusUser> RadiusUsers { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.Email).IsUnique();
            
            entity.HasOne(e => e.DefaultInstant)
                  .WithMany()
                  .HasForeignKey(e => e.DefaultInstantId)
                  .OnDelete(DeleteBehavior.SetNull);
                  
            entity.HasOne(e => e.CurrentInstant)
                  .WithMany()
                  .HasForeignKey(e => e.CurrentInstantId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
