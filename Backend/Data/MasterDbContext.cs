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
    public DbSet<Role> Roles { get; set; }
    public DbSet<Group> Groups { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<UserRole> UserRoles { get; set; }
    public DbSet<UserGroup> UserGroups { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }
    public DbSet<UserWorkspace> UserWorkspaces { get; set; }
    public DbSet<BackupHistory> BackupHistories { get; set; }
    public DbSet<ApprovedMicroservice> ApprovedMicroservices { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.KeycloakUserId);
            
            entity.HasOne(e => e.DefaultWorkspace)
                  .WithMany()
                  .HasForeignKey(e => e.DefaultWorkspaceId)
                  .OnDelete(DeleteBehavior.SetNull);
                  
            entity.HasOne(e => e.CurrentWorkspace)
                  .WithMany()
                  .HasForeignKey(e => e.CurrentWorkspaceId)
                  .OnDelete(DeleteBehavior.SetNull);
                  
            entity.HasOne(e => e.Supervisor)
                  .WithMany(s => s.Subordinates)
                  .HasForeignKey(e => e.SupervisorId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
        
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
        });
        
        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
        });
        
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(ur => new { ur.UserId, ur.RoleId });
            
            entity.HasOne(ur => ur.User)
                  .WithMany(u => u.UserRoles)
                  .HasForeignKey(ur => ur.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
            entity.HasOne(ur => ur.Role)
                  .WithMany(r => r.UserRoles)
                  .HasForeignKey(ur => ur.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
        
        modelBuilder.Entity<UserGroup>(entity =>
        {
            entity.HasKey(ug => new { ug.UserId, ug.GroupId });
            
            entity.HasOne(ug => ug.User)
                  .WithMany(u => u.UserGroups)
                  .HasForeignKey(ug => ug.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
            entity.HasOne(ug => ug.Group)
                  .WithMany(g => g.UserGroups)
                  .HasForeignKey(ug => ug.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
        
        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Category).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => e.Name).IsUnique();
        });
        
        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(rp => new { rp.RoleId, rp.PermissionId });
            
            entity.HasOne(rp => rp.Role)
                  .WithMany(r => r.RolePermissions)
                  .HasForeignKey(rp => rp.RoleId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
            entity.HasOne(rp => rp.Permission)
                  .WithMany(p => p.RolePermissions)
                  .HasForeignKey(rp => rp.PermissionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserWorkspace>(entity =>
        {
            entity.HasKey(uw => new { uw.UserId, uw.WorkspaceId });
            
            entity.HasOne(uw => uw.User)
                  .WithMany(u => u.UserWorkspaces)
                  .HasForeignKey(uw => uw.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
            entity.HasOne(uw => uw.Workspace)
                  .WithMany()
                  .HasForeignKey(uw => uw.WorkspaceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

