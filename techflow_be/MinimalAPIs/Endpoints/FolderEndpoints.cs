using MinimalAPIs.Contracts.Folders;
using MinimalAPIs.Data;
using MinimalAPIs.Domain.Entities;
using MinimalAPIs.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace MinimalAPIs.Endpoints;

public static class FolderEndpoints
{
    public static IEndpointRouteBuilder MapFolderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/folders")
            .WithTags("Folders")
            .RequireAuthorization();

        group.MapGet("", GetFoldersAsync);
        group.MapGet("/{id:int}/files", GetFolderFilesAsync);
        group.MapPost("", CreateFolderAsync)
            .RequireAuthorization(new AuthorizeAttribute { Roles = $"{nameof(UserRole.TechLeader)},{nameof(UserRole.Admin)}" });
        group.MapDelete("/{id:int}", DeleteFolderAsync)
            .RequireAuthorization(new AuthorizeAttribute { Roles = $"{nameof(UserRole.TechLeader)},{nameof(UserRole.Admin)}" });

        return app;
    }

    private static async Task<IResult> GetFoldersAsync(
        int categoryId,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var folders = await dbContext.Folders
            .AsNoTracking()
            .Where(x => x.CategoryId == categoryId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var stoppedFolderIds = await dbContext.Files
            .Where(f => f.IsStopped && f.Folder.CategoryId == categoryId)
            .Select(f => f.FolderId)
            .Distinct()
            .ToListAsync(cancellationToken);
            
        var stoppedFoldersSet = new HashSet<int>(stoppedFolderIds);

        var folderLookup = folders.ToLookup(x => x.ParentId);
        var tree = BuildTree(folderLookup, null, stoppedFoldersSet);

        return Results.Ok(tree);
    }

    private static async Task<IResult> GetFolderFilesAsync(
        int id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var folderExists = await dbContext.Folders.AnyAsync(x => x.Id == id, cancellationToken);
        if (!folderExists)
            return Results.NotFound("Folder not found.");

        // Load all files in this folder with their versions and distributions
        var files = await dbContext.Files
            .AsNoTracking()
            .Include(f => f.Versions)
            .Include(f => f.Folder)
            .Where(f => f.FolderId == id)
            .ToListAsync(cancellationToken);

        // Load distributions for these files separately to get department codes
        var fileIds = files.Select(f => f.Id).ToList();
        var distributions = await dbContext.Distributions
            .AsNoTracking()
            .Include(d => d.Department)
            .Include(d => d.FileVersion)
            .Where(d => fileIds.Contains(d.FileVersion.FileId))
            .ToListAsync(cancellationToken);

        var result = files.SelectMany(file =>
        {
            return file.Versions.Select(version =>
            {
                var fileDists = distributions
                    .Where(d => d.FileVersionId == version.Id)
                    .ToList();

                var sentTo = fileDists
                    .Select(d => d.Department.Code)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToList();

                var confirmedBy = fileDists
                    .Where(d => d.Status == DistributionStatus.Confirmed)
                    .Select(d => d.Department.Code)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToList();

                return new FolderFileDto(
                    file.Id,
                    version.Id,
                    version.FileName,
                    file.IsStopped,
                    version.VersionNumber,
                    version.FileUrl,
                    version.FilePath,
                    version.ChangeReason,
                    version.CreatedAt,
                    sentTo,
                    confirmedBy);
            });
        }).OrderByDescending(x => x.CreatedAt).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> CreateFolderAsync(
        CreateFolderRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest("Folder name is required.");
        }

        var categoryExists = await dbContext.Categories.AnyAsync(x => x.Id == request.CategoryId, cancellationToken);
        if (!categoryExists)
        {
            return Results.NotFound("Category not found.");
        }

        if (request.ParentId.HasValue)
        {
            var parentFolder = await dbContext.Folders.FirstOrDefaultAsync(x => x.Id == request.ParentId.Value, cancellationToken);
            if (parentFolder is null)
            {
                return Results.NotFound("Parent folder not found.");
            }

            if (parentFolder.CategoryId != request.CategoryId)
            {
                return Results.BadRequest("Parent folder must belong to the same category.");
            }
        }

        var folder = new Folder
        {
            Name = request.Name.Trim(),
            CategoryId = request.CategoryId,
            ParentId = request.ParentId,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Folders.Add(folder);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new CreateFolderResponse(
            Id: folder.Id,
            Name: folder.Name,
            ParentId: folder.ParentId));
    }

    private static async Task<IResult> DeleteFolderAsync(
        int id,
        AppDbContext dbContext,
        MinimalAPIs.Services.NotificationBroadcaster broadcaster,
        CancellationToken cancellationToken)
    {
        // Recursively find all folders to delete
        var allFolders = await dbContext.Folders.ToListAsync(cancellationToken);
        var folderToDelete = allFolders.FirstOrDefault(f => f.Id == id);
        
        if (folderToDelete == null)
            return Results.NotFound("Folder not found.");

        var folderIdsToDelete = new HashSet<int>();
        void AddToSet(Folder f)
        {
            folderIdsToDelete.Add(f.Id);
            var children = allFolders.Where(child => child.ParentId == f.Id);
            foreach (var child in children)
            {
                AddToSet(child);
            }
        }
        AddToSet(folderToDelete);

        // Fetch all files in these folders
        var files = await dbContext.Files
            .Where(f => folderIdsToDelete.Contains(f.FolderId))
            .Select(f => f.Id)
            .ToListAsync(cancellationToken);

        // Fetch all versions of these files
        var fileVersions = await dbContext.FileVersions
            .Where(v => files.Contains(v.FileId))
            .Select(v => v.Id)
            .ToListAsync(cancellationToken);

        // Start deleting from the leaves up to the root (Distributions -> FileVersions -> Files -> Folders)
        if (fileVersions.Any())
        {
            await dbContext.Distributions
                .Where(d => fileVersions.Contains(d.FileVersionId))
                .ExecuteDeleteAsync(cancellationToken);

            await dbContext.FileVersions
                .Where(v => files.Contains(v.FileId))
                .ExecuteDeleteAsync(cancellationToken);
        }

        if (files.Any())
        {
            await dbContext.Files
                .Where(f => folderIdsToDelete.Contains(f.FolderId))
                .ExecuteDeleteAsync(cancellationToken);
        }

        if (folderIdsToDelete.Any())
        {
            // Delete notifications linked to these folders first
            await dbContext.Notifications
                .Where(n => n.TargetFolderId != null && folderIdsToDelete.Contains(n.TargetFolderId.Value))
                .ExecuteDeleteAsync(cancellationToken);

            // EF Core bulk delete might fail if we delete parents before children due to Restrict.
            // But ExecuteDelete doesn't execute in order of relationships unless we specify.
            // Since we're just deleting them all, and SQL Server/Postgres might complain about FK constraint if we delete all at once.
            // Let's delete from bottom to top.
            var orderedFoldersToDelete = allFolders
                .Where(f => folderIdsToDelete.Contains(f.Id))
                .OrderByDescending(f => GetDepth(f, allFolders))
                .ToList();

            foreach (var f in orderedFoldersToDelete)
            {
                dbContext.Folders.Remove(f);
            }
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        // Notify Admins so dashboard auto-refreshes
        await broadcaster.BroadcastToAdminsAsync("DataDeleted", new { FolderId = id });

        return Results.NoContent();
    }

    private static int GetDepth(Folder f, List<Folder> all)
    {
        int depth = 0;
        var current = f;
        while (current.ParentId.HasValue)
        {
            depth++;
            current = all.FirstOrDefault(x => x.Id == current.ParentId);
            if (current == null) break;
        }
        return depth;
    }

    private static List<FolderTreeDto> BuildTree(ILookup<int?, Folder> lookup, int? parentId, HashSet<int> stoppedFoldersSet)
    {
        return lookup[parentId]
            .OrderBy(x => x.Name)
            .Select(folder => 
            {
                var children = BuildTree(lookup, folder.Id, stoppedFoldersSet);
                bool hasStoppedFiles = stoppedFoldersSet.Contains(folder.Id) || children.Any(c => c.HasStoppedFiles);
                return new FolderTreeDto(
                    folder.Id,
                    folder.Name,
                    folder.ParentId,
                    children,
                    hasStoppedFiles);
            })
            .ToList();
    }
}