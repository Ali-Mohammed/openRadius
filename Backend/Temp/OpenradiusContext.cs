using System;
using System.Collections.Generic;
using Backend.Temp.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Temp;

public partial class OpenradiusContext : DbContext
{
    public OpenradiusContext()
    {
    }

    public OpenradiusContext(DbContextOptions<OpenradiusContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Group> Groups { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // Configuration should be done via dependency injection in the main application context
        // This is a temporary context file that should use configuration from appsettings
        if (!optionsBuilder.IsConfigured)
        {
            optionsBuilder.UseNpgsql("Name=DefaultConnection");
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasIndex(e => e.Name, "IX_Groups_Name").IsUnique();

            entity.Property(e => e.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasIndex(e => e.Name, "IX_Permissions_Name").IsUnique();

            entity.Property(e => e.Category).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(e => e.Name, "IX_Roles_Name").IsUnique();

            entity.Property(e => e.Name).HasMaxLength(100);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
