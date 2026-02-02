using Microsoft.EntityFrameworkCore;
using Backend.Models;
using Backend.Models.Management;
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
    public DbSet<RadiusIpReservation> RadiusIpReservations { get; set; }
    public DbSet<RadiusCustomAttribute> RadiusCustomAttributes { get; set; }
    public DbSet<SasRadiusIntegration> SasRadiusIntegrations { get; set; }
    public DbSet<SyncProgress> SyncProgresses { get; set; }
    public DbSet<SessionSyncProgress> SessionSyncProgresses { get; set; }
    public DbSet<DebeziumSettings> DebeziumSettings { get; set; }
    public DbSet<DebeziumConnector> DebeziumConnectors { get; set; }
    public DbSet<CustomWallet> CustomWallets { get; set; }
    public DbSet<UserWallet> UserWallets { get; set; }
    public DbSet<CashbackGroup> CashbackGroups { get; set; }
    public DbSet<CashbackGroupUser> CashbackGroupUsers { get; set; }
    public DbSet<CashbackProfileAmount> CashbackProfileAmounts { get; set; }
    public DbSet<UserCashback> UserCashbacks { get; set; }
    public DbSet<SubAgentCashback> SubAgentCashbacks { get; set; }
    public DbSet<WalletHistory> WalletHistories { get; set; }
    public DbSet<Transaction> Transactions { get; set; }
    public DbSet<TransactionComment> TransactionComments { get; set; }
    public DbSet<TransactionHistory> TransactionHistories { get; set; }
    public DbSet<Addon> Addons { get; set; }
    public DbSet<Automation> Automations { get; set; }
    public DbSet<WorkflowHistory> WorkflowHistories { get; set; }
    public DbSet<BillingGroup> BillingGroups { get; set; }
    public DbSet<BillingProfile> BillingProfiles { get; set; }
    public DbSet<BillingProfileWallet> BillingProfileWallets { get; set; }
    public DbSet<BillingProfileAddon> BillingProfileAddons { get; set; }
    public DbSet<BillingProfileUser> BillingProfileUsers { get; set; }
    public DbSet<TablePreference> TablePreferences { get; set; }
    public DbSet<Zone> Zones { get; set; }
    public DbSet<UserZone> UserZones { get; set; }
    public DbSet<Dashboard> Dashboards { get; set; }
    public DbSet<MicroserviceApproval> MicroserviceApprovals { get; set; }
    public DbSet<RadiusActivation> RadiusActivations { get; set; }
    public DbSet<BillingActivation> BillingActivations { get; set; }
    public DbSet<DashboardTab> DashboardTabs { get; set; }
    public DbSet<DashboardItem> DashboardItems { get; set; }
    public DbSet<DashboardGlobalFilter> DashboardGlobalFilters { get; set; }
    public DbSet<OltDevice> OltDevices { get; set; }
    public DbSet<Olt> Olts { get; set; }
    public DbSet<PonPort> PonPorts { get; set; }
    public DbSet<IntegrationWebhook> IntegrationWebhooks { get; set; }
    public DbSet<WebhookLog> WebhookLogs { get; set; }
    public DbSet<Fdt> Fdts { get; set; }
    public DbSet<Fat> Fats { get; set; }
    public DbSet<FatPort> FatPorts { get; set; }
    public DbSet<RadiusAccounting> RadiusAccounting { get; set; }
    public DbSet<PaymentMethod> PaymentMethods { get; set; }
    public DbSet<Models.Payments.PaymentLog> PaymentLogs { get; set; }
    public DbSet<SasActivationLog> SasActivationLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Ignore all User navigation properties - User table is in MasterDbContext only
        // All CreatedByUser, UpdatedByUser, DeletedByUser navigation properties are ignored
        modelBuilder.Ignore<User>();

        // Ignore User navigation properties for all entities with audit fields
        // These entities have CreatedBy/UpdatedBy/DeletedBy int fields but no FK constraints
        var entityTypes = new[]
        {
            typeof(BillingActivation), typeof(Addon), typeof(Automation), typeof(BillingGroup), typeof(BillingProfile),
            typeof(CashbackGroup), typeof(CashbackProfileAmount), typeof(CustomWallet),
            typeof(Dashboard), typeof(DashboardItem), typeof(DashboardTab), typeof(DashboardGlobalFilter),
            typeof(Fat), typeof(FatPort), typeof(Fdt), typeof(OltDevice), typeof(Olt), typeof(PonPort),
            typeof(RadiusActivation), typeof(RadiusCustomAttribute), typeof(RadiusGroup),
            typeof(RadiusIpReservation), typeof(RadiusNas), typeof(Transaction),
            typeof(TransactionComment), typeof(UserCashback), typeof(UserWallet),
            typeof(UserZone), typeof(WalletHistory), typeof(WorkflowHistory), typeof(Zone),
            typeof(BillingGroupUser), typeof(SubAgentCashback), typeof(BillingProfileUser)
        };

        foreach (var entityType in entityTypes)
        {
            var entity = modelBuilder.Entity(entityType);
            
            // Ignore all User navigation properties (CreatedByUser, UpdatedByUser, DeletedByUser)
            var userProperties = entityType.GetProperties()
                .Where(p => p.PropertyType == typeof(User) && 
                           (p.Name.EndsWith("User") || p.Name == "User"))
                .ToList();
            
            foreach (var prop in userProperties)
            {
                entity.Ignore(prop.Name);
            }
        }

        // UserCashback: Ignore User navigation property since Users table is in MasterDbContext
        modelBuilder.Entity<UserCashback>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Ignore(e => e.User); // User is in master database, not workspace database
            
            entity.HasOne(e => e.BillingProfile)
                  .WithMany()
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RadiusUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.HasOne(e => e.Profile)
                  .WithMany()
                  .HasForeignKey(e => e.ProfileId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(e => e.RadiusGroup)
                  .WithMany()
                  .HasForeignKey(e => e.GroupId)
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

        modelBuilder.Entity<RadiusIpReservation>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Index for IP address lookups and uniqueness checks
            entity.HasIndex(e => e.IpAddress);
            
            // Index for user lookups
            entity.HasIndex(e => e.RadiusUserId);
            
            // Index for soft delete filtering
            entity.HasIndex(e => e.DeletedAt);
            
            // Composite index for active IP uniqueness (IP + DeletedAt)
            entity.HasIndex(e => new { e.IpAddress, e.DeletedAt })
                  .HasFilter("\"DeletedAt\" IS NULL");
            
            // Composite index for active user reservations (User + DeletedAt)
            entity.HasIndex(e => new { e.RadiusUserId, e.DeletedAt })
                  .HasFilter("\"DeletedAt\" IS NULL");
            
            // Foreign key relationship
            entity.HasOne(e => e.RadiusUser)
                  .WithMany()
                  .HasForeignKey(e => e.RadiusUserId)
                  .OnDelete(DeleteBehavior.SetNull);
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
            entity.HasIndex(e => e.TransactionGroupId);
            entity.HasIndex(e => e.CashbackStatus);
            entity.HasIndex(e => e.DeletedAt);
            
            // Composite index for pending cashback queries (enterprise optimization)
            entity.HasIndex(e => new { e.WalletType, e.TransactionType, e.CashbackStatus, e.DeletedAt });
            
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
                  .OnDelete(DeleteBehavior.Restrict)
                  .IsRequired(false);
            
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

        modelBuilder.Entity<BillingProfileUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.BillingProfileId, e.UserId }).IsUnique();
            
            entity.HasOne(e => e.BillingProfile)
                  .WithMany(p => p.ProfileUsers)
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            // UserId and AssignedBy reference User table in MasterDbContext
            // No foreign key constraint, navigation properties are ignored via modelBuilder.Ignore<User>()
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

        // Zone configuration
        modelBuilder.Entity<Zone>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            
            // Add query filter to exclude soft-deleted zones by default
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<UserZone>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.ZoneId }).IsUnique();
            
            entity.HasOne(e => e.Zone)
                  .WithMany(z => z.UserZones)
                  .HasForeignKey(e => e.ZoneId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TablePreference>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.TableName).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => new { e.UserId, e.TableName }).IsUnique();
        });

        modelBuilder.Entity<CashbackGroup>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.Disabled);
            entity.HasIndex(e => e.DeletedAt);
            
            // Add query filter to exclude soft-deleted groups by default
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        modelBuilder.Entity<CashbackGroupUser>(entity =>
        {
            entity.HasKey(e => new { e.CashbackGroupId, e.UserId });
            entity.HasIndex(e => e.UserId);
            
            entity.HasOne(e => e.CashbackGroup)
                  .WithMany(g => g.CashbackGroupUsers)
                  .HasForeignKey(e => e.CashbackGroupId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            // UserId is stored but not a foreign key (references master database User table)
        });

        modelBuilder.Entity<CashbackProfileAmount>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.CashbackGroupId, e.BillingProfileId });
            
            entity.HasOne(e => e.CashbackGroup)
                  .WithMany()
                  .HasForeignKey(e => e.CashbackGroupId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.BillingProfile)
                  .WithMany()
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.Property(e => e.Amount)
                  .HasColumnType("decimal(18,2)");
            
            // Add query filter to exclude soft-deleted amounts by default
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        modelBuilder.Entity<SubAgentCashback>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique index: one cashback per supervisor-subagent-profile combination (excluding soft-deleted)
            entity.HasIndex(e => new { e.SupervisorId, e.SubAgentId, e.BillingProfileId })
                  .IsUnique()
                  .HasFilter("\"DeletedAt\" IS NULL");
            
            // Indexes for lookups
            entity.HasIndex(e => e.SupervisorId);
            entity.HasIndex(e => e.SubAgentId);
            entity.HasIndex(e => e.BillingProfileId);
            entity.HasIndex(e => e.DeletedAt);
            
            entity.HasOne(e => e.BillingProfile)
                  .WithMany()
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.Property(e => e.Amount)
                  .HasColumnType("decimal(18,2)");
            
            // Add query filter to exclude soft-deleted cashbacks by default
            entity.HasQueryFilter(e => e.DeletedAt == null);
        });

        modelBuilder.Entity<RadiusActivation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.RadiusUserId);
            entity.HasIndex(e => e.RadiusProfileId);
            entity.HasIndex(e => e.BillingProfileId);
            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.ApiStatus);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.RadiusUserId, e.CreatedAt });

            entity.HasOne(e => e.RadiusUser)
                  .WithMany()
                  .HasForeignKey(e => e.RadiusUserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.RadiusProfile)
                  .WithMany()
                  .HasForeignKey(e => e.RadiusProfileId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.PreviousRadiusProfile)
                  .WithMany()
                  .HasForeignKey(e => e.PreviousRadiusProfileId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.BillingProfile)
                  .WithMany()
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.PreviousBillingProfile)
                  .WithMany()
                  .HasForeignKey(e => e.PreviousBillingProfileId)
                  .OnDelete(DeleteBehavior.SetNull);

            // Relationship: Many RadiusActivations to One BillingActivation
            entity.HasOne(e => e.BillingActivation)
                  .WithMany(ba => ba.RadiusActivations)
                  .HasForeignKey(e => e.BillingActivationId)
                  .OnDelete(DeleteBehavior.Restrict);

            // Add query filter to exclude soft-deleted activations by default
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<BillingActivation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.RadiusUserId);
            entity.HasIndex(e => e.BillingProfileId);
            entity.HasIndex(e => e.ActionById);
            entity.HasIndex(e => e.ActivationType);
            entity.HasIndex(e => e.ActivationStatus);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.RadiusUserId, e.CreatedAt });

            entity.HasOne(e => e.BillingProfile)
                  .WithMany()
                  .HasForeignKey(e => e.BillingProfileId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Transaction)
                  .WithMany()
                  .HasForeignKey(e => e.TransactionId)
                  .OnDelete(DeleteBehavior.SetNull);

            // Add query filter to exclude soft-deleted billing activations
            entity.HasQueryFilter(e => !e.IsDeleted);
        });
    }
}

