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
    public DbSet<RadiusGroup> RadiusGroups { get; set; }
    public DbSet<RadiusTag> RadiusTags { get; set; }
    public DbSet<RadiusUserTag> RadiusUserTags { get; set; }
    public DbSet<RadiusNas> RadiusNasDevices { get; set; }
    public DbSet<RadiusIpPool> RadiusIpPools { get; set; }
    public DbSet<SasRadiusIntegration> SasRadiusIntegrations { get; set; }
    public DbSet<SyncProgress> SyncProgresses { get; set; }
    public DbSet<DebeziumSettings> DebeziumSettings { get; set; }
    public DbSet<DebeziumConnector> DebeziumConnectors { get; set; }
    public DbSet<CustomWallet> CustomWallets { get; set; }
    public DbSet<UserWallet> UserWallets { get; set; }
    public DbSet<WalletHistory> WalletHistories { get; set; }
    public DbSet<Transaction> Transactions { get; set; }
    public DbSet<TransactionComment> TransactionComments { get; set; }
    public DbSet<TransactionHistory> TransactionHistories { get; set; }
    public DbSet<Addon> Addons { get; set; }

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

        modelBuilder.Entity<RadiusTag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Title);
        });

        modelBuilder.Entity<RadiusUserTag>(entity =>
        {
            entity.HasKey(rut => new { rut.RadiusUserId, rut.RadiusTagId });

            entity.HasOne(rut => rut.RadiusUser)
                  .WithMany(ru => ru.RadiusUserTags)
                  .HasForeignKey(rut => rut.RadiusUserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rut => rut.RadiusTag)
                  .WithMany(rt => rt.RadiusUserTags)
                  .HasForeignKey(rut => rut.RadiusTagId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RadiusNas>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Nasname);
            entity.HasIndex(e => e.Shortname);
        });

        modelBuilder.Entity<RadiusIpPool>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
        });

        modelBuilder.Entity<CustomWallet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => e.Status);
            
            // Add query filter to exclude soft-deleted custom wallets by default
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<UserWallet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CustomWalletId);
            entity.HasIndex(e => e.Status);
            
            // Composite index for user + custom wallet (prevents duplicate wallet types per user)
            entity.HasIndex(e => new { e.UserId, e.CustomWalletId })
                  .IsUnique()
                  .HasFilter("\"IsDeleted\" = false");
            
            // Add query filter to exclude soft-deleted user wallets by default
            entity.HasQueryFilter(e => !e.IsDeleted);
            
            // Configure relationships
            entity.HasOne(e => e.CustomWallet)
                  .WithMany()
                  .HasForeignKey(e => e.CustomWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<WalletHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.WalletType);
            entity.HasIndex(e => e.CustomWalletId);
            entity.HasIndex(e => e.UserWalletId);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.TransactionType);
            entity.HasIndex(e => e.CreatedAt);
            
            // Configure relationships
            entity.HasOne(e => e.CustomWallet)
                  .WithMany()
                  .HasForeignKey(e => e.CustomWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
                  
            entity.HasOne(e => e.UserWallet)
                  .WithMany()
                  .HasForeignKey(e => e.UserWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.WalletType);
            entity.HasIndex(e => e.CustomWalletId);
            entity.HasIndex(e => e.UserWalletId);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.TransactionType);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.RelatedTransactionId);
            
            // Add query filter to exclude soft-deleted transactions by default
            entity.HasQueryFilter(e => !e.IsDeleted);
            
            // Configure relationships
            entity.HasOne(e => e.CustomWallet)
                  .WithMany()
                  .HasForeignKey(e => e.CustomWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
                  
            entity.HasOne(e => e.UserWallet)
                  .WithMany()
                  .HasForeignKey(e => e.UserWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
                  
            entity.HasOne(e => e.RelatedTransaction)
                  .WithMany()
                  .HasForeignKey(e => e.RelatedTransactionId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TransactionComment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TransactionId);
            entity.HasIndex(e => e.CreatedAt);
            
            entity.HasOne(e => e.Transaction)
                  .WithMany()
                  .HasForeignKey(e => e.TransactionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TransactionHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TransactionId);
            entity.HasIndex(e => e.Action);
            entity.HasIndex(e => e.PerformedAt);
            
            entity.HasOne(e => e.Transaction)
                  .WithMany()
                  .HasForeignKey(e => e.TransactionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

