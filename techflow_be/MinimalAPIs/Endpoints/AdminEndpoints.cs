using System.Security.Claims;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MinimalAPIs.Contracts.Admin;
using MinimalAPIs.Data;
using MinimalAPIs.Domain.Entities;
using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Endpoints;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin")
            .RequireAuthorization(new AuthorizeAttribute { Roles = nameof(UserRole.Admin) });

        // ── Users ─────────────────────────────────────────────────────────────
        group.MapGet("/users", GetUsersAsync);
        group.MapPost("/users", CreateUserAsync);
        group.MapPut("/users/{id:int}", UpdateUserAsync);
        group.MapDelete("/users/{id:int}", DeleteUserAsync);

        // ── Categories ────────────────────────────────────────────────────────
        group.MapGet("/categories", GetCategoriesAsync);
        group.MapPost("/categories", CreateCategoryAsync);
        group.MapPut("/categories/{id:int}", UpdateCategoryAsync);
        group.MapDelete("/categories/{id:int}", DeleteCategoryAsync);

        // ── Dashboard ─────────────────────────────────────────────────────────
        group.MapGet("/dashboard/stats", GetDashboardStatsAsync);
        group.MapPost("/dashboard/remind-overdue", RemindOverdueAsync);

        // ── History ───────────────────────────────────────────────────────────
        group.MapGet("/history", GetHistoryAsync);

        return app;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // USER HANDLERS
    // ══════════════════════════════════════════════════════════════════════════

    private static async Task<IResult> GetUsersAsync(AppDbContext db, CancellationToken ct)
    {
        var users = await db.Users
            .Include(u => u.Category)
            .Include(u => u.Department)
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Username)
            .Select(u => new AdminUserDto(
                u.Id,
                u.Username,
                u.Role.ToString(),
                u.CategoryId,
                u.Category != null ? u.Category.Name : null,
                u.DepartmentId,
                u.Department != null ? u.Department.Name : null))
            .ToListAsync(ct);

        return Results.Ok(users);
    }

    private static async Task<IResult> CreateUserAsync(
        CreateUserRequest request,
        AppDbContext db,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return Results.BadRequest("Username and password are required.");

        var exists = await db.Users.AnyAsync(u => u.Username == request.Username, ct);
        if (exists)
            return Results.Conflict("Username already exists.");

        var user = new User
        {
            Username = request.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            CategoryId = request.CategoryId,
            DepartmentId = request.DepartmentId
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        // If TechLeader is assigned to a category, also set them as the category leader
        if (user.Role == UserRole.TechLeader && user.CategoryId.HasValue)
        {
            var cat = await db.Categories.FindAsync([user.CategoryId.Value], ct);
            if (cat is not null)
            {
                cat.LeaderId = user.Id;
                await db.SaveChangesAsync(ct);
            }
        }

        return Results.Ok(new AdminUserDto(
            user.Id,
            user.Username,
            user.Role.ToString(),
            user.CategoryId,
            null,
            user.DepartmentId,
            null));
    }

    private static async Task<IResult> UpdateUserAsync(
        int id,
        UpdateUserRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user is null) return Results.NotFound("User not found.");

        var oldCategoryId = user.CategoryId;

        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            var taken = await db.Users.AnyAsync(u => u.Username == request.Username && u.Id != id, ct);
            if (taken) return Results.Conflict("Username already taken.");
            user.Username = request.Username.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        if (request.Role.HasValue)
            user.Role = request.Role.Value;

        // Use -1 as sentinel to explicitly clear a nullable FK
        if (request.CategoryId.HasValue)
            user.CategoryId = request.CategoryId.Value == -1 ? null : request.CategoryId.Value;

        if (request.DepartmentId.HasValue)
            user.DepartmentId = request.DepartmentId.Value == -1 ? null : request.DepartmentId.Value;

        await db.SaveChangesAsync(ct);

        // Sync Category.LeaderId when TechLeader's category changes
        var newCategoryId = user.CategoryId;
        if (user.Role == UserRole.TechLeader)
        {
            // Clear old category's leader if it was this user
            if (oldCategoryId.HasValue && oldCategoryId != newCategoryId)
            {
                var oldCat = await db.Categories.FindAsync([oldCategoryId.Value], ct);
                if (oldCat is not null && oldCat.LeaderId == id)
                {
                    oldCat.LeaderId = null;
                    await db.SaveChangesAsync(ct);
                }
            }
            // Set new category's leader
            if (newCategoryId.HasValue)
            {
                var newCat = await db.Categories.FindAsync([newCategoryId.Value], ct);
                if (newCat is not null)
                {
                    newCat.LeaderId = id;
                    await db.SaveChangesAsync(ct);
                }
            }
        }
        else
        {
            // Role changed away from TechLeader — clear their leadership from old category
            if (oldCategoryId.HasValue)
            {
                var oldCat = await db.Categories.FindAsync([oldCategoryId.Value], ct);
                if (oldCat is not null && oldCat.LeaderId == id)
                {
                    oldCat.LeaderId = null;
                    await db.SaveChangesAsync(ct);
                }
            }
        }

        return Results.Ok(new { message = "Updated." });
    }

    private static async Task<IResult> DeleteUserAsync(
        int id,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken ct)
    {
        // Prevent self-delete
        var currentId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(currentId, out var selfId) && selfId == id)
            return Results.BadRequest("Cannot delete your own account.");

        var user = await db.Users.FindAsync([id], ct);
        if (user is null) return Results.NotFound("User not found.");

        // Cascade delete FileVersions uploaded by this user
        var fileVersions = await db.FileVersions.Where(fv => fv.UploadedById == id).ToListAsync(ct);
        var fvIds = fileVersions.Select(fv => fv.Id).ToList();
        var distributions = await db.Distributions.Where(d => fvIds.Contains(d.FileVersionId)).ToListAsync(ct);

        db.Distributions.RemoveRange(distributions);
        db.FileVersions.RemoveRange(fileVersions);

        // Also delete any Files that would be left with zero versions
        var fileIds = fileVersions.Select(fv => fv.FileId).Distinct().ToList();
        var remainingVersions = await db.FileVersions
            .Where(fv => fileIds.Contains(fv.FileId) && fv.UploadedById != id)
            .Select(fv => fv.FileId)
            .Distinct()
            .ToListAsync(ct);

        var emptyFileIds = fileIds.Except(remainingVersions).ToList();
        var emptyFiles = await db.Files.Where(f => emptyFileIds.Contains(f.Id)).ToListAsync(ct);
        db.Files.RemoveRange(emptyFiles);

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { message = "Deleted." });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CATEGORY HANDLERS
    // ══════════════════════════════════════════════════════════════════════════

    private static async Task<IResult> GetCategoriesAsync(AppDbContext db, CancellationToken ct)
    {
        var cats = await db.Categories
            .Include(c => c.Leader)
            .OrderBy(c => c.Name)
            .Select(c => new AdminCategoryDto(
                c.Id,
                c.Name,
                c.LeaderId,
                c.Leader != null ? c.Leader.Username : null))
            .ToListAsync(ct);

        return Results.Ok(cats);
    }

    private static async Task<IResult> CreateCategoryAsync(
        CreateCategoryRequest request,
        AppDbContext db,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest("Category name is required.");

        var cat = new Category { Name = request.Name.Trim() };
        db.Categories.Add(cat);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new AdminCategoryDto(cat.Id, cat.Name, null, null));
    }

    private static async Task<IResult> UpdateCategoryAsync(
        int id,
        UpdateCategoryRequest request,
        AppDbContext db,
        CancellationToken ct)
    {
        var cat = await db.Categories.FindAsync([id], ct);
        if (cat is null) return Results.NotFound("Category not found.");

        if (!string.IsNullOrWhiteSpace(request.Name))
            cat.Name = request.Name.Trim();

        if (request.LeaderId.HasValue)
        {
            if (request.LeaderId.Value == -1)
            {
                cat.LeaderId = null;
            }
            else
            {
                var leader = await db.Users.FindAsync([request.LeaderId.Value], ct);
                if (leader is null) return Results.NotFound("Leader user not found.");
                if (leader.Role != UserRole.TechLeader)
                    return Results.BadRequest("The assigned leader must have the 'TechLeader' role.");
                cat.LeaderId = leader.Id;
            }
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { message = "Updated." });
    }

    private static async Task<IResult> DeleteCategoryAsync(
        int id,
        AppDbContext db,
        CancellationToken ct)
    {
        var cat = await db.Categories.FindAsync([id], ct);
        if (cat is null) return Results.NotFound("Category not found.");

        // Cascade delete all Folders -> Files -> FileVersions -> Distributions
        var folders = await db.Folders.Where(f => f.CategoryId == id).OrderByDescending(f => f.Id).ToListAsync(ct);
        var folderIds = folders.Select(f => f.Id).ToList();

        var files = await db.Files.Where(f => folderIds.Contains(f.FolderId)).ToListAsync(ct);
        var fileIds = files.Select(f => f.Id).ToList();

        var fileVersions = await db.FileVersions.Where(fv => fileIds.Contains(fv.FileId)).ToListAsync(ct);
        var fvIds = fileVersions.Select(fv => fv.Id).ToList();

        var distributions = await db.Distributions.Where(d => fvIds.Contains(d.FileVersionId)).ToListAsync(ct);

        db.Distributions.RemoveRange(distributions);
        db.FileVersions.RemoveRange(fileVersions);
        db.Files.RemoveRange(files);
        db.Folders.RemoveRange(folders);

        db.Categories.Remove(cat);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { message = "Deleted." });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DASHBOARD HANDLER
    // ══════════════════════════════════════════════════════════════════════════

    private static async Task<IResult> GetDashboardStatsAsync(AppDbContext db, [FromQuery] int? categoryId, CancellationToken ct)
    {
        // ── Determine "NEW" file versions ────────────────────────────────────
        // Mirrors frontend logic: within each folder, the FileVersion with the
        // highest CreatedAt is "NEW" (shown with green badge in production view).

        // Load all FileVersions with their folder info (lightweight projection)
        var allVersionsQuery = db.FileVersions
            .Include(fv => fv.File)
            .ThenInclude(f => f.Folder)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            allVersionsQuery = allVersionsQuery.Where(fv => fv.File.Folder.CategoryId == categoryId.Value);
        }

        var allVersions = await allVersionsQuery
            .Select(fv => new { fv.Id, fv.FileId, FolderId = fv.File.FolderId, fv.CreatedAt })
            .ToListAsync(ct);

        // Max CreatedAt per folder
        var maxCreatedAtPerFolder = allVersions
            .GroupBy(fv => fv.FolderId)
            .ToDictionary(g => g.Key, g => g.Max(fv => fv.CreatedAt));

        // FileVersion IDs that are "NEW" (newest in their folder)
        var newVersionIds = allVersions
            .Where(fv => fv.CreatedAt == maxCreatedAtPerFolder[fv.FolderId])
            .Select(fv => fv.Id)
            .ToHashSet();

        // ── Active Files ───────────────────────────────────────────────────────
        // Non-stopped files that are "NEW" (their version is newest in the folder)
        var newFileIds = allVersions
            .Where(fv => newVersionIds.Contains(fv.Id))
            .Select(fv => fv.FileId)
            .ToHashSet();

        var activeFilesQuery = db.Files.Where(f => !f.IsStopped && newFileIds.Contains(f.Id));
        if (categoryId.HasValue)
        {
            activeFilesQuery = activeFilesQuery.Where(f => f.Folder.CategoryId == categoryId.Value);
        }
        var totalActiveFiles = await activeFilesQuery.CountAsync(ct);

        // ── Distributions (only for NEW versions) ─────────────────────────────
        var distributionsQuery = db.Distributions
            .Where(d => newVersionIds.Contains(d.FileVersionId))
            .Include(d => d.Department)
            .Include(d => d.FileVersion)
                .ThenInclude(fv => fv.File)
                    .ThenInclude(f => f.Folder)
                        .ThenInclude(fo => fo.Category)
            .AsQueryable();

        var distributions = await distributionsQuery.ToListAsync(ct);

        var now = DateTime.UtcNow;

        var totalConfirmed = distributions.Count(d => d.Status == DistributionStatus.Confirmed);
        var totalOverdue = distributions.Count(d =>
            d.Status == DistributionStatus.Overdue ||
            (d.Status == DistributionStatus.Pending && d.DeadlineTime.HasValue && d.DeadlineTime.Value < now));
        var totalPending = distributions.Count(d =>
            d.Status == DistributionStatus.Pending &&
            (!d.DeadlineTime.HasValue || d.DeadlineTime.Value >= now));

        var total = distributions.Count;
        var rate = total > 0 ? Math.Round((double)totalConfirmed / total * 100, 1) : 0;

        // Top 10 most recent overdue
        var overdueAlerts = distributions
            .Where(d =>
                d.Status == DistributionStatus.Overdue ||
                (d.Status == DistributionStatus.Pending && d.DeadlineTime.HasValue && d.DeadlineTime.Value < now))
            .OrderByDescending(d => d.DeadlineTime)
            .Take(10)
            .Select(d =>
            {
                var hoursOverdue = (now - d.DeadlineTime!.Value).TotalHours;
                var file = d.FileVersion.File;
                var category = file?.Folder?.Category;
                return new OverdueAlertDto(
                    d.Id,
                    d.Department.Name,
                    file?.FileName ?? "Unknown",
                    d.FileVersion.VersionNumber,
                    category?.Name ?? "Unknown",
                    d.DeadlineTime.Value,
                    Math.Round(hoursOverdue, 1));
            })
            .ToList();

        return Results.Ok(new DashboardStatsDto(
            totalActiveFiles,
            rate,
            totalConfirmed,
            totalPending,
            totalOverdue,
            overdueAlerts));
    }

    private static async Task<IResult> RemindOverdueAsync(
        AppDbContext db,
        MinimalAPIs.Services.NotificationBroadcaster broadcaster,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var overdueDistributions = await db.Distributions
            .Include(d => d.Department)
            .Include(d => d.FileVersion)
                .ThenInclude(fv => fv.File)
            .Where(d => d.Status == DistributionStatus.Overdue || (d.Status == DistributionStatus.Pending && d.DeadlineTime.HasValue && d.DeadlineTime.Value < now))
            .ToListAsync(ct);

        if (overdueDistributions.Count == 0)
        {
            return Results.Ok(new { message = "No overdue distributions to remind." });
        }

        var newNotifications = new List<Notification>();

        foreach (var distribution in overdueDistributions)
        {
            newNotifications.Add(new Notification
            {
                DepartmentId = distribution.DepartmentId,
                Title = "URGENT: Overdue Reminder",
                Message = $"ADMIN REMINDER: File {distribution.FileVersion.File.FileName} v{distribution.FileVersion.VersionNumber} is severely overdue. Confirm immediately!",
                TargetFolderId = distribution.FileVersion.File.FolderId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        db.Notifications.AddRange(newNotifications);
        await db.SaveChangesAsync(ct);

        var deptIds = overdueDistributions.Select(d => d.DepartmentId).Distinct().ToList();
        await broadcaster.BroadcastToDepartmentsAsync(deptIds, "DeadlineOverdue", new { Message = "URGENT OVERDUE REMINDER FROM ADMIN!" });

        return Results.Ok(new { message = $"Reminders sent to {deptIds.Count} departments for {overdueDistributions.Count} overdue files." });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HISTORY HANDLERS
    // ══════════════════════════════════════════════════════════════════════════

    private static async Task<IResult> GetHistoryAsync(AppDbContext db, CancellationToken ct)
    {
        var rawHistory = await db.Distributions
            .AsNoTracking()
            .Include(d => d.FileVersion)
                .ThenInclude(fv => fv.File)
                    .ThenInclude(f => f.Folder)
                        .ThenInclude(fo => fo.Category)
            .Include(d => d.FileVersion.UploadedBy)
            .Include(d => d.Department)
            .OrderByDescending(d => d.FileVersion.CreatedAt)
            .ToListAsync(ct);

        var allFolders = await db.Folders.AsNoTracking().ToDictionaryAsync(f => f.Id, ct);

        string GetFullFolderPath(int folderId)
        {
            var path = new List<string>();
            var currId = (int?)folderId;
            while (currId.HasValue && allFolders.TryGetValue(currId.Value, out var folder))
            {
                path.Insert(0, folder.Name);
                currId = folder.ParentId;
            }
            return string.Join(" / ", path);
        }

        var history = rawHistory.Select(d => new HistoryDto(
            d.Id,
            d.FileVersion.FileName,
            d.FileVersion.VersionNumber,
            GetFullFolderPath(d.FileVersion.File.FolderId),
            d.FileVersion.File.Folder.Category.Name,
            d.FileVersion.UploadedBy.Username,
            d.FileVersion.CreatedAt,
            d.Department.Name,
            d.ConfirmedAt,
            d.Status.ToString(),
            d.FileVersion.File.IsStopped
        )).ToList();

        return Results.Ok(history);
    }
}
