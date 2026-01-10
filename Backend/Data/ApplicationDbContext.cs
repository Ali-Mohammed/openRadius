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
    public DbSet<RadiusProfileWallet> RadiusProfileWallets { get; set; }
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
    public DbSet<BillingGroup> BillingGroups { get; set; }
    public DbSet<BillingProfile> BillingProfiles { get; set; }
    public DbSet<BillingProfileWallet> BillingProfileWallets { get; set; }
    public DbSet<BillingProfileAddon> BillingProfileAddons { get; set; }
    public DbSet<Zone> Zones { get; set; }
    public DbSet<UserZone> UserZones { get; set; }
    public DbSet<Dashboard> Dashboards { get; set; }
    public DbSet<DashboardTab> DashboardTabs { get; set; }
    public DbSet<DashboardItem> DashboardItems { get; set; }
    public DbSet<DashboardGlobalFilter> DashboardGlobalFilters { get; set; }
    public DbSet<OltDevice> OltDevices { get; set; }
    public DbSet<Olt> Olts { get; set; }
    public DbSet<PonPort> PonPorts { get; set; }
    public DbSet<Fdt> Fdts { get; set; }
    public DbSet<Fat> Fats { get; set; }
    public DbSet<FatPort> FatPorts { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Ignore User navigation properties for auth system (managed in MasterDbContext)
        modelBuilder.Entity<User>().Ignore(u => u.UserRoles);
        modelBuilder.Entity<User>().Ignore(u => u.UserGroups);

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

        modelBuilder.Entity<BillingGroup>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.IsActive);
            
            // Add query filter to exclude soft-deleted groups by default
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<BillingGroupUser>(entity =>
        {
            entity.HasKey(gu => new { gu.GroupId, gu.UserId });
            entity.HasIndex(gu => gu.UserId);

            entity.HasOne(gu => gu.Group)
                  .WithMany(g => g.GroupUsers)
                  .HasForeignKey(gu => gu.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            // Note: UserId references Users table in master DB, not workspace DB
            // So we don't create a foreign key constraint here
        });

        modelBuilder.Entity<BillingProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.RadiusProfileId);
            entity.HasIndex(e => e.BillingGroupId);
            
            entity.HasOne(e => e.RadiusProfile)
                  .WithMany()
                  .HasForeignKey(e => e.RadiusProfileId)
                  .OnDelete(DeleteBehavior.Restrict);
            
            entity.HasOne(e => e.BillingGroup)
                  .WithMany()
                  .HasForeignKey(e => e.BillingGroupId)
                  .OnDelete(DeleteBehavior.Restrict);
            
            // Add query filter to exclude soft-deleted profiles by default
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<BillingProfileWallet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.BillingProfileId);
            
            entity.HasOne(e => e.BillingProfile)
                  .WithMany(p => p.ProfileWallets)
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.UserWallet)
                  .WithMany()
                  .HasForeignKey(e => e.UserWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
            
            entity.HasOne(e => e.CustomWallet)
                  .WithMany()
                  .HasForeignKey(e => e.CustomWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BillingProfileAddon>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.BillingProfileId);
            
            entity.HasOne(e => e.BillingProfile)
                  .WithMany(p => p.ProfileAddons)
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RadiusProfileWallet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.RadiusProfileId);
            entity.HasIndex(e => e.CustomWalletId);
            
            entity.HasOne(e => e.RadiusProfile)
                  .WithMany()
                  .HasForeignKey(e => e.RadiusProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.CustomWallet)
                  .WithMany()
                  .HasForeignKey(e => e.CustomWalletId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }
}

