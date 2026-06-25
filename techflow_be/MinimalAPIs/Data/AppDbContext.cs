using FileEntity = MinimalAPIs.Domain.Entities.File;
using MinimalAPIs.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MinimalAPIs.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<FileEntity> Files => Set<FileEntity>();
    public DbSet<FileVersion> FileVersions => Set<FileVersion>();
    public DbSet<Distribution> Distributions => Set<Distribution>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.UseIdentityByDefaultColumns();

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Username).IsRequired().HasMaxLength(100);
            entity.Property(x => x.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(x => x.Role).IsRequired();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasOne(x => x.Category)
                .WithMany(x => x.Users)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Department)
                .WithMany(x => x.Users)
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("Categories");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
            entity.HasOne(x => x.Leader)
                .WithMany(x => x.LedCategories)
                .HasForeignKey(x => x.LeaderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("Departments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).IsRequired().HasMaxLength(50);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
        });

        modelBuilder.Entity<Folder>(entity =>
        {
            entity.ToTable("Folders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
            entity.Property(x => x.CreatedAt)
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Parent)
                .WithMany(x => x.Children)
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Category)
                .WithMany(x => x.Folders)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FileEntity>(entity =>
        {
            entity.ToTable("Files");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FileName).IsRequired().HasMaxLength(500);
            entity.Property(x => x.IsStopped).HasDefaultValue(false);
            entity.Property(x => x.CreatedAt)
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Folder)
                .WithMany(x => x.Files)
                .HasForeignKey(x => x.FolderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FileVersion>(entity =>
        {
            entity.ToTable("FileVersions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FileName).IsRequired().HasMaxLength(500).HasDefaultValue(string.Empty);
            entity.Property(x => x.FileUrl).IsRequired().HasMaxLength(1000);
            entity.Property(x => x.ChangeReason).HasMaxLength(1000);
            entity.Property(x => x.CreatedAt)
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasIndex(x => new { x.FileId, x.VersionNumber }).IsUnique();

            entity.HasOne(x => x.File)
                .WithMany(x => x.Versions)
                .HasForeignKey(x => x.FileId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.UploadedBy)
                .WithMany(x => x.UploadedFileVersions)
                .HasForeignKey(x => x.UploadedById)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Distribution>(entity =>
        {
            entity.ToTable("Distributions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Status).IsRequired();
            entity.Property(x => x.DeadlineTime).HasColumnType("timestamp with time zone");
            entity.Property(x => x.ConfirmedAt).HasColumnType("timestamp with time zone");

            entity.HasOne(x => x.FileVersion)
                .WithMany(x => x.Distributions)
                .HasForeignKey(x => x.FileVersionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Department)
                .WithMany(x => x.Distributions)
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("Notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Title).IsRequired().HasMaxLength(250);
            entity.Property(x => x.Message).IsRequired().HasMaxLength(2000);
            entity.Property(x => x.IsRead).HasDefaultValue(false);
            entity.Property(x => x.CreatedAt)
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Department)
                .WithMany(x => x.Notifications)
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.TargetFolder)
                .WithMany()
                .HasForeignKey(x => x.TargetFolderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<User>().Property(x => x.Role).HasConversion<string>();
        modelBuilder.Entity<Distribution>().Property(x => x.Status).HasConversion<string>();
    }
}