using System.Security.Claims;
using MinimalAPIs.Contracts.Files;
using MinimalAPIs.Data;
using MinimalAPIs.Domain.Entities;
using MinimalAPIs.Domain.Enums;
using MinimalAPIs.Hubs;
using MinimalAPIs.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using FileEntity = MinimalAPIs.Domain.Entities.File;

namespace MinimalAPIs.Endpoints;

public static class FileEndpoints
{
    // ── Validate đuôi file chỉ cho phép .png .pdf .dwg ──────────────────────
    private static bool IsValidExtension(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".png" or ".pdf" or ".dwg";
    }

    private const string BasePath = @"D:\Technical Drawing\";

    public static IEndpointRouteBuilder MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/files")
            .WithTags("Files")
            .RequireAuthorization();

        // ── POST /api/files/upload ─────────────────────────────────────────
        group.MapPost("/upload", async (
            [FromForm] int folderId,
            [FromForm] string departmentIds,
            IFormFile file,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            IHubContext<NotificationHub> hubContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            // ── Validation ────────────────────────────────────────────────
            if (folderId <= 0)
                return Results.BadRequest("FolderId is required.");

            if (file == null || file.Length == 0)
                return Results.BadRequest("File is required.");

            if (!IsValidExtension(file.FileName))
                return Results.BadRequest("Only .png, .pdf, and .dwg files are allowed.");

            var folderExists = await dbContext.Folders.AnyAsync(x => x.Id == folderId, cancellationToken);
            if (!folderExists)
                return Results.NotFound("Folder not found.");

            var departmentIdList = System.Text.Json.JsonSerializer.Deserialize<List<int>>(departmentIds)?.Distinct().ToList() ?? new List<int>();
            if (departmentIdList.Count == 0)
                return Results.BadRequest("At least one departmentId is required.");

            var validDepartmentIds = await dbContext.Departments
                .Where(x => departmentIdList.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            if (validDepartmentIds.Count != departmentIdList.Count)
                return Results.BadRequest("One or more departmentIds are invalid.");

            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId))
                return Results.Unauthorized();

            // ── Save physical file ────────────────────────────────────────
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var originalFileName = Path.GetFileName(file.FileName);
            var uniqueFileName = $"{Guid.NewGuid():N}_{originalFileName}";
            var physicalFilePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(physicalFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            var fileUrl = $"/uploads/{uniqueFileName}";

            // ── Resolve or create File record ─────────────────────────────
            FileEntity? fileRecord = await dbContext.Files
                .FirstOrDefaultAsync(x => x.FolderId == folderId, cancellationToken);

            if (fileRecord is null)
            {
                fileRecord = new FileEntity
                {
                    FolderId = folderId,
                    FileName = originalFileName,
                    IsStopped = false,
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.Files.Add(fileRecord);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            // ── Resolve next version number ───────────────────────────────
            var nextVersionNumber = await dbContext.FileVersions
                .Where(x => x.FileId == fileRecord.Id)
                .Select(x => (int?)x.VersionNumber)
                .MaxAsync(cancellationToken) ?? 0;

            // ── Insert FileVersion ────────────────────────────────────────
            var fileVersion = new FileVersion
            {
                FileId = fileRecord.Id,
                FileName = originalFileName,
                VersionNumber = nextVersionNumber + 1,
                FileUrl = fileUrl,
                ChangeReason = null,
                UploadedById = userId,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.FileVersions.Add(fileVersion);
            await dbContext.SaveChangesAsync(cancellationToken);

            // ── Insert Distributions & Notifications ──────────────────────
            var distributions = departmentIdList.Select(deptId => new Distribution
            {
                FileVersionId = fileVersion.Id,
                DepartmentId = deptId,
                Status = DistributionStatus.Pending,
                DeadlineTime = DateTime.UtcNow.AddHours(24),
                ConfirmedAt = null
            }).ToList();

            var notifications = departmentIdList.Select(deptId => new Notification
            {
                DepartmentId = deptId,
                Title = "New file version uploaded",
                Message = $"{fileRecord.FileName} v{fileVersion.VersionNumber} was uploaded.",
                TargetFolderId = folderId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            dbContext.Distributions.AddRange(distributions);
            dbContext.Notifications.AddRange(notifications);
            await dbContext.SaveChangesAsync(cancellationToken);

            // ── SignalR broadcast ─────────────────────────────────────────
            await broadcaster.BroadcastToDepartmentsAsync(departmentIdList, "NewUploadNotification", new
            {
                FileId = fileRecord.Id,
                FileVersionId = fileVersion.Id,
                fileRecord.FileName,
                fileVersion.VersionNumber,
                DepartmentIds = departmentIdList
            });

            await broadcaster.BroadcastToAdminsAsync("NewUploadNotification", new
            {
                FileId = fileRecord.Id,
                FileVersionId = fileVersion.Id,
                fileRecord.FileName,
                fileVersion.VersionNumber
            });

            return Results.Ok(new UploadFileResponse(
                fileRecord.Id,
                fileVersion.Id,
                fileVersion.VersionNumber,
                fileVersion.FileUrl));
        })
        .DisableAntiforgery()
        .WithSummary("Upload a new drawing via multipart/form-data");

        group.MapGet("/{id:int}/history", GetHistoryAsync);
        group.MapPost("/{id:int}/stop", StopAsync);
        group.MapPost("/{id:int}/resume", ResumeAsync);
        group.MapPost("/{fileId:int}/versions/{versionId:int}/rollback", RollbackAsync);

        // ── POST /api/files/{id}/resume-with-file ─────────────────────────
        group.MapPost("/{id:int}/resume-with-file", async (
            int id,
            [FromForm] string departmentNotes,
            IFormFile file,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId))
                return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
                return Results.Forbid();

            var fileRecord = await dbContext.Files.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (fileRecord is null)
                return Results.NotFound("File not found.");

            if (!fileRecord.IsStopped)
                return Results.BadRequest("File is not stopped.");

            if (file == null || file.Length == 0)
                return Results.BadRequest("File is required.");

            if (!IsValidExtension(file.FileName))
                return Results.BadRequest("Only .png, .pdf, and .dwg files are allowed.");

            var notesList = System.Text.Json.JsonSerializer.Deserialize<List<DepartmentNoteDto>>(departmentNotes, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (notesList == null || notesList.Count == 0)
                return Results.BadRequest("At least one department note is required.");

            // ── Save physical file ────────────────────────────────────────
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var originalFileName = Path.GetFileName(file.FileName);
            var uniqueFileName = $"{Guid.NewGuid():N}_{originalFileName}";
            var physicalFilePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(physicalFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            var fileUrl = $"/uploads/{uniqueFileName}";

            // Create new FileVersion with path
            var nextVersionNumber = await dbContext.FileVersions
                .Where(x => x.FileId == fileRecord.Id)
                .Select(x => (int?)x.VersionNumber)
                .MaxAsync(cancellationToken) ?? 0;

            var fileVersion = new FileVersion
            {
                FileId = fileRecord.Id,
                FileName = originalFileName,
                VersionNumber = nextVersionNumber + 1,
                FileUrl = fileUrl,
                ChangeReason = "Resumed with new revision",
                UploadedById = userId,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.FileVersions.Add(fileVersion);

            fileRecord.IsStopped = false;
            var resumedDepartmentIds = fileRecord.StoppedDepartmentIds.ToList();
            fileRecord.StoppedDepartmentIds = [];

            await dbContext.SaveChangesAsync(cancellationToken);

            var allDeptIds = notesList.Select(d => d.DepartmentId).Distinct().ToList();

            var distributions = notesList.Select(dn => new Distribution
            {
                FileVersionId = fileVersion.Id,
                DepartmentId = dn.DepartmentId,
                Status = DistributionStatus.Pending,
                DeadlineTime = DateTime.UtcNow.AddHours(24),
                ConfirmedAt = null,
                Note = dn.Note
            }).ToList();
            dbContext.Distributions.AddRange(distributions);

            var notifications = notesList.Select(dn => new Notification
            {
                DepartmentId = dn.DepartmentId,
                Title = dn.IsAffected
                    ? $"[RESUME + Revision mới - Có ảnh hưởng] {fileVersion.FileName} v{fileVersion.VersionNumber}"
                    : $"[RESUME + Revision mới - Không ảnh hưởng] {fileVersion.FileName} v{fileVersion.VersionNumber}",
                Message = dn.Note,
                TargetFolderId = fileRecord.FolderId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();
            dbContext.Notifications.AddRange(notifications);

            await dbContext.SaveChangesAsync(cancellationToken);

            await broadcaster.BroadcastToDepartmentsAsync(allDeptIds, "Production_Resume", new
            {
                FileId = fileRecord.Id,
                FileName = fileVersion.FileName,
                fileVersion.VersionNumber,
                HasNewFile = true
            });

            await broadcaster.BroadcastToAdminsAsync("Production_Resume", new
            {
                FileId = fileRecord.Id,
                FileName = fileVersion.FileName,
                fileVersion.VersionNumber,
                HasNewFile = true
            });

            return Results.Ok(new UploadFileResponse(
                fileRecord.Id,
                fileVersion.Id,
                fileVersion.VersionNumber,
                fileVersion.FileUrl));
        })
        .DisableAntiforgery()
        .WithSummary("Resume a stopped file with a new physical file");

        return app;
    }

    // ── GET /api/files/{id}/history ───────────────────────────────────────────
    private static async Task<IResult> GetHistoryAsync(
        int id,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var fileExists = await dbContext.Files.AnyAsync(x => x.Id == id, cancellationToken);
        if (!fileExists)
            return Results.NotFound();

        var history = await dbContext.FileVersions
            .AsNoTracking()
            .Where(x => x.FileId == id)
            .OrderByDescending(x => x.VersionNumber)
            .Select(x => new FileHistoryItemDto(
                x.Id,
                x.VersionNumber,
                x.FileUrl,
                x.ChangeReason,
                x.UploadedBy.Username,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(history);
    }

    // ── POST /api/files/{id}/stop ─────────────────────────────────────────────
    private static async Task<IResult> StopAsync(
        int id,
        [FromBody] StopRequest request,
        ClaimsPrincipal user,
        AppDbContext dbContext,
        NotificationBroadcaster broadcaster,
        CancellationToken cancellationToken)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId))
            return Results.Unauthorized();

        var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
        if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
            return Results.Forbid();

        var file = await dbContext.Files.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (file is null)
            return Results.NotFound();

        file.IsStopped = true;
        file.StoppedDepartmentIds = request.DepartmentIds ?? [];

        var departmentIds = request.DepartmentIds ?? [];
        if (departmentIds.Any())
        {
            var notifications = departmentIds.Select(deptId => new Notification
            {
                DepartmentId = deptId,
                Title = $"[EMERGENCY STOP] {file.FileName}",
                Message = $"Production stopped for {file.FileName}.",
                TargetFolderId = file.FolderId,
                TargetFileId = file.Id,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();
            dbContext.Notifications.AddRange(notifications);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await broadcaster.BroadcastToDepartmentsAsync(
            departmentIds,
            "Emergency_Stop",
            new { FileId = file.Id, file.FileName });

        await broadcaster.BroadcastToAdminsAsync("Emergency_Stop", new { FileId = file.Id, file.FileName });

        return Results.Ok(new StopFileResponse("Stop triggered"));
    }

    // ── POST /api/files/{id}/resume ───────────────────────────────────────────
    private static async Task<IResult> ResumeAsync(
        int id,
        [FromBody] ResumeRequest request,
        ClaimsPrincipal user,
        AppDbContext dbContext,
        NotificationBroadcaster broadcaster,
        CancellationToken cancellationToken)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId))
            return Results.Unauthorized();

        var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
        if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
            return Results.Forbid();

        var file = await dbContext.Files.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (file is null)
            return Results.NotFound();

        if (!file.IsStopped)
            return Results.BadRequest("File is not stopped.");

        file.IsStopped = false;
        var resumedDepartmentIds = file.StoppedDepartmentIds.ToList();
        file.StoppedDepartmentIds = [];
        await dbContext.SaveChangesAsync(cancellationToken);

        var notifications = new List<Notification>();
        var notesList = request.DepartmentNotes ?? new List<DepartmentNoteDto>();

        foreach (var deptId in resumedDepartmentIds)
        {
            var note = notesList.FirstOrDefault(n => n.DepartmentId == deptId);
            if (note != null && !string.IsNullOrWhiteSpace(note.Note))
            {
                notifications.Add(new Notification
                {
                    DepartmentId = deptId,
                    Title = note.IsAffected
                        ? $"[RESUME - Affected] {file.FileName}"
                        : $"[RESUME - Unaffected] {file.FileName}",
                    Message = note.Note,
                    TargetFolderId = file.FolderId,
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                notifications.Add(new Notification
                {
                    DepartmentId = deptId,
                    Title = $"[RESUME - No Changes] {file.FileName}",
                    Message = "Production has resumed. No file changes or specific notes were provided.",
                    TargetFolderId = file.FolderId,
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        if (notifications.Any())
        {
            dbContext.Notifications.AddRange(notifications);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await broadcaster.BroadcastToDepartmentsAsync(
            resumedDepartmentIds,
            "Production_Resume",
            new { FileId = file.Id, file.FileName, HasNewFile = false });

        await broadcaster.BroadcastToAdminsAsync("Production_Resume", new { FileId = file.Id, file.FileName, HasNewFile = false });

        return Results.Ok(new { Message = "Resume triggered" });
    }

    // ── POST /api/files/{fileId}/versions/{versionId}/rollback ──────────────
    private static async Task<IResult> RollbackAsync(
        int fileId,
        int versionId,
        [FromBody] RollbackRequest request,
        ClaimsPrincipal user,
        AppDbContext dbContext,
        NotificationBroadcaster broadcaster,
        CancellationToken cancellationToken)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId))
            return Results.Unauthorized();

        var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
        if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
            return Results.Forbid();

        var file = await dbContext.Files.FirstOrDefaultAsync(x => x.Id == fileId, cancellationToken);
        if (file is null)
            return Results.NotFound("File not found.");

        var sourceVersion = await dbContext.FileVersions
            .FirstOrDefaultAsync(x => x.Id == versionId && x.FileId == fileId, cancellationToken);
        if (sourceVersion is null)
            return Results.NotFound("Source version not found.");

        if (string.IsNullOrWhiteSpace(request.ChangeReason))
            return Results.BadRequest("ChangeReason is required for rollback.");

        // Tự động lấy departments từ phiên bản mới nhất của file
        var latestVersionId = await dbContext.FileVersions
            .Where(x => x.FileId == fileId)
            .OrderByDescending(x => x.VersionNumber)
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var validDepartmentIds = latestVersionId.HasValue
            ? await dbContext.Distributions
                .Where(x => x.FileVersionId == latestVersionId.Value)
                .Select(x => x.DepartmentId)
                .Distinct()
                .ToListAsync(cancellationToken)
            : new List<int>();

        if (validDepartmentIds.Count == 0)
            return Results.BadRequest("No departments found for the current version of this file.");

        var nextVersionNumber = await dbContext.FileVersions
            .Where(x => x.FileId == fileId)
            .Select(x => (int?)x.VersionNumber)
            .MaxAsync(cancellationToken) ?? 0;
        nextVersionNumber++;

        // Rollback: tái sử dụng FileUrl của version cũ
        var newVersion = new FileVersion
        {
            FileId = fileId,
            FileName = sourceVersion.FileName,
            VersionNumber = nextVersionNumber,
            FileUrl = sourceVersion.FileUrl,  // Reuse đường dẫn cũ
            ChangeReason = request.ChangeReason,
            UploadedById = userId,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.FileVersions.Add(newVersion);
        await dbContext.SaveChangesAsync(cancellationToken);

        var distributions = validDepartmentIds.Select(deptId => new Distribution
        {
            FileVersionId = newVersion.Id,
            DepartmentId = deptId,
            Status = DistributionStatus.Pending,
            DeadlineTime = DateTime.UtcNow.AddHours(24)
        }).ToList();

        var notifications = validDepartmentIds.Select(deptId => new Notification
        {
            DepartmentId = deptId,
            Title = "File version rolled back",
            Message = $"{file.FileName} was rolled back to v{nextVersionNumber}.",
            TargetFolderId = file.FolderId,
            TargetFileId = file.Id,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        dbContext.Distributions.AddRange(distributions);
        dbContext.Notifications.AddRange(notifications);
        await dbContext.SaveChangesAsync(cancellationToken);

        await broadcaster.BroadcastToDepartmentsAsync(
            validDepartmentIds,
            "NewUploadNotification",
            new { FileId = file.Id, FileName = newVersion.FileName, VersionNumber = nextVersionNumber });

        return Results.Ok(new UploadFileResponse(
            file.Id,
            newVersion.Id,
            nextVersionNumber,
            newVersion.FileUrl));
    }
}
