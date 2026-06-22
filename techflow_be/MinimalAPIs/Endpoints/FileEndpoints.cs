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
using Microsoft.OpenApi.Models;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using FileEntity = MinimalAPIs.Domain.Entities.File;

namespace MinimalAPIs.Endpoints;

public static class FileEndpoints
{
    /// <summary>
    /// Uploads a file to Cloudinary using the correct resource type so the returned URL
    /// can be previewed directly in a browser (img / iframe).
    /// - PNG / JPG / JPEG / GIF → ImageUploadParams  (delivery URL has extension, works in <img>)
    /// - PDF                    → RawUploadParams + UseFilename  (URL keeps .pdf, works in <iframe>)
    /// - DWG / anything else   → RawUploadParams (no browser preview possible)
    /// </summary>
    private static async Task<string> UploadToCloudinaryAsync(Cloudinary cloudinary, IFormFile file)
    {
        var ext = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
        await using var stream = file.OpenReadStream();

        if (ext is "png" or "jpg" or "jpeg" or "gif")
        {
            var p = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = "techflow/uploads",
                UseFilename = true,
                UniqueFilename = true
            };
            var r = await cloudinary.UploadAsync(p);
            if (r.Error != null) throw new InvalidOperationException(r.Error.Message);
            return r.SecureUrl.ToString();
        }
        else  // pdf, dwg, or anything raw
        {
            var p = new RawUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = "techflow/uploads",
                UseFilename = true,
                UniqueFilename = true
            };
            var r = await cloudinary.UploadAsync(p);
            if (r.Error != null) throw new InvalidOperationException(r.Error.Message);
            return r.SecureUrl.ToString();
        }
    }
    public static IEndpointRouteBuilder MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/files")
            .WithTags("Files")
            .RequireAuthorization();

        // ── Upload endpoint uses Inline Delegate Parameters ──────────────────
        // This is the only pattern Swashbuckle 6.x can correctly render as
        // multipart/form-data when IFormFile is mixed with [FromForm] primitives.
        // Key rules:
        //   • All primitive/string params carry [FromForm]
        //   • IFormFile is declared WITHOUT [FromForm] so Swashbuckle auto-detects it
        //   • int[]? departmentIds uses [FromForm] — Swashbuckle renders it as a
        //     repeatable string field; callers send it as multiple form keys
        //   • .DisableAntiforgery() is REQUIRED for .NET 8 form data without CSRF tokens
        group.MapPost("/upload", async (
            [FromForm] int folderId,
            [FromForm] string? fileIdStr,
            [FromForm] string? changeReason,
            [FromForm] int[]? departmentIds,
            [FromForm] string? rollbackFromVersionIdStr,
            [FromForm] string? deadlineTimeStr,
            IFormFile file,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            IWebHostEnvironment environment,
            IHubContext<NotificationHub> hubContext,
            NotificationBroadcaster broadcaster,
            Cloudinary cloudinary,
            CancellationToken cancellationToken) =>
        {
            // ── Manual parameter parsing ───────────────────────────────────────
            int? fileId = string.IsNullOrWhiteSpace(fileIdStr) ? null : int.Parse(fileIdStr);
            int? rollbackFromVersionId = string.IsNullOrWhiteSpace(rollbackFromVersionIdStr) ? null : int.Parse(rollbackFromVersionIdStr);
            DateTime? deadlineTime = string.IsNullOrWhiteSpace(deadlineTimeStr) ? null : DateTime.Parse(deadlineTimeStr);

            // ── Validation ────────────────────────────────────────────────────
            if (folderId <= 0)
                return Results.BadRequest("FolderId is required.");

            if (fileId.HasValue && string.IsNullOrWhiteSpace(changeReason))
                return Results.BadRequest("ChangeReason is required when updating an existing file.");

            if (rollbackFromVersionId.HasValue && !fileId.HasValue)
                return Results.BadRequest("FileId is required when rolling back.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".pdf" && ext != ".png" && ext != ".dwg")
                return Results.BadRequest("Only PDF, PNG, and DWG files are allowed.");

            var folderExists = await dbContext.Folders.AnyAsync(x => x.Id == folderId, cancellationToken);
            if (!folderExists)
                return Results.NotFound("Folder not found.");

            var departmentIdList = (departmentIds ?? Array.Empty<int>()).Distinct().ToList();
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

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);

            // ── Resolve or create file record ─────────────────────────────────
            FileEntity? fileRecord;
            if (fileId.HasValue)
            {
                fileRecord = await dbContext.Files.FirstOrDefaultAsync(x => x.Id == fileId.Value, cancellationToken);
                if (fileRecord is null)
                    return Results.NotFound("File not found.");
            }
            else
            {
                var targetFileName = Path.GetFileNameWithoutExtension(file.FileName);
                fileRecord = await dbContext.Files.FirstOrDefaultAsync(x => x.FolderId == folderId && x.FileName == targetFileName, cancellationToken);

                if (fileRecord is null)
                {
                    fileRecord = new FileEntity
                    {
                        FolderId = folderId,
                        FileName = targetFileName,
                        IsStopped = false,
                        CreatedAt = DateTime.UtcNow
                    };
                    dbContext.Files.Add(fileRecord);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    // Do not update the file name to the latest uploaded file name
                    // so that previous versions retain the original document name.
                }
            }

            // ── Resolve next version number ───────────────────────────────────
            var nextVersionNumber = await dbContext.FileVersions
                .Where(x => x.FileId == fileRecord.Id)
                .Select(x => (int?)x.VersionNumber)
                .MaxAsync(cancellationToken) ?? 0;

            // ── Save physical file OR reuse rollback URL ───────────────────────
            string fileUrl;
            if (rollbackFromVersionId.HasValue)
            {
                var rollbackVersion = await dbContext.FileVersions.FirstOrDefaultAsync(
                    x => x.Id == rollbackFromVersionId.Value && x.FileId == fileRecord.Id,
                    cancellationToken);

                if (rollbackVersion is null)
                    return Results.NotFound("Rollback source version not found.");

                fileUrl = rollbackVersion.FileUrl;
            }
            else
            {
                try
                {
                    fileUrl = await UploadToCloudinaryAsync(cloudinary, file);
                }
                catch (InvalidOperationException ex)
                {
                    return Results.BadRequest($"Cloudinary Upload Error: {ex.Message}");
                }
            }

            // ── Insert FileVersion ─────────────────────────────────────────────
            var fileVersion = new FileVersion
            {
                FileId = fileRecord.Id,
                VersionNumber = nextVersionNumber + 1,
                FileUrl = fileUrl,
                ChangeReason = changeReason,
                UploadedById = currentUser.Id,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.FileVersions.Add(fileVersion);
            await dbContext.SaveChangesAsync(cancellationToken);

            // ── Insert Distributions & Notifications per department ────────────
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

            // ── Trigger SignalR broadcast ──────────────────────────────────────
            await broadcaster.BroadcastToDepartmentsAsync(departmentIdList, "NewUploadNotification", new
            {
                FileId = fileRecord.Id,
                FileVersionId = fileVersion.Id,
                fileRecord.FileName,
                fileVersion.VersionNumber,
                DepartmentIds = departmentIdList
            });

            return Results.Ok(new UploadFileResponse(
                fileRecord.Id,
                fileVersion.Id,
                fileVersion.VersionNumber,
                fileUrl));
        })
        .DisableAntiforgery()
        .WithSummary("Upload a new file or version")
        .WithDescription("Accepts multipart/form-data with a physical file (PDF, PNG, DWG) and routing parameters. " +
                         "Pass departmentIds as repeated form fields (e.g. departmentIds=1&departmentIds=2). " +
                         "Omit fileId to create a new file; supply fileId + changeReason to add a new version.");

        group.MapGet("/{id:int}/history", GetHistoryAsync);
        group.MapPost("/{id:int}/stop", StopAsync);
        group.MapPost("/{id:int}/resume", ResumeAsync);
        group.MapPost("/{fileId:int}/versions/{versionId:int}/rollback", RollbackAsync);

        // ── POST /api/files/{id}/resume-with-file (multipart) ──────────────────
        group.MapPost("/{id:int}/resume-with-file", async (
            int id,
            [FromForm] string departmentNotesJson,
            IFormFile file,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            Cloudinary cloudinary,
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

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".pdf" && ext != ".png" && ext != ".dwg")
                return Results.BadRequest("Only PDF, PNG, and DWG files are allowed.");

            // Parse per-department notes from JSON string (needed because IFormFile cannot mix with complex object)
            List<DepartmentNoteDto> departmentNotes;
            try
            {
                departmentNotes = System.Text.Json.JsonSerializer.Deserialize<List<DepartmentNoteDto>>(
                    departmentNotesJson,
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
            }
            catch
            {
                return Results.BadRequest("Invalid departmentNotesJson format.");
            }

            if (departmentNotes.Count == 0)
                return Results.BadRequest("At least one department note is required.");

            // Upload new file to Cloudinary
            string fileUrl;
            try
            {
                fileUrl = await UploadToCloudinaryAsync(cloudinary, file);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest($"Cloudinary Upload Error: {ex.Message}");
            }

            // Create new FileVersion
            var nextVersionNumber = await dbContext.FileVersions
                .Where(x => x.FileId == fileRecord.Id)
                .Select(x => (int?)x.VersionNumber)
                .MaxAsync(cancellationToken) ?? 0;

            var fileVersion = new FileVersion
            {
                FileId = fileRecord.Id,
                VersionNumber = nextVersionNumber + 1,
                FileUrl = fileUrl,
                ChangeReason = "Resumed with new revision",
                UploadedById = userId,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.FileVersions.Add(fileVersion);

            // Resume the file
            fileRecord.IsStopped = false;
            var resumedDepartmentIds = fileRecord.StoppedDepartmentIds.ToList();
            fileRecord.StoppedDepartmentIds = [];

            await dbContext.SaveChangesAsync(cancellationToken);

            // All departments (affected and unaffected) get a Distribution to confirm + a Notification with per-dept note
            var allDeptIds = departmentNotes.Select(d => d.DepartmentId).Distinct().ToList();

            var distributions = departmentNotes.Select(dn => new Distribution
            {
                FileVersionId = fileVersion.Id,
                DepartmentId = dn.DepartmentId,
                Status = DistributionStatus.Pending,
                DeadlineTime = null,
                ConfirmedAt = null,
                Note = dn.Note
            }).ToList();
            dbContext.Distributions.AddRange(distributions);

            var notifications = departmentNotes.Select(dn => new Notification
            {
                DepartmentId = dn.DepartmentId,
                Title = dn.IsAffected
                    ? $"[RESUME + Revision mới - Có ảnh hưởng] {fileRecord.FileName} v{fileVersion.VersionNumber}"
                    : $"[RESUME + Revision mới - Không ảnh hưởng] {fileRecord.FileName} v{fileVersion.VersionNumber}",
                Message = dn.Note,
                TargetFolderId = null,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();
            dbContext.Notifications.AddRange(notifications);

            await dbContext.SaveChangesAsync(cancellationToken);

            await broadcaster.BroadcastToDepartmentsAsync(
                allDeptIds,
                "Production_Resume",
                new
                {
                    FileId = fileRecord.Id,
                    fileRecord.FileName,
                    fileVersion.VersionNumber,
                    HasNewFile = true
                });

            return Results.Ok(new UploadFileResponse(
                fileRecord.Id,
                fileVersion.Id,
                fileVersion.VersionNumber,
                fileUrl));
        })
        .DisableAntiforgery()
        .WithSummary("Resume a stopped file with a new file version")
        .WithDescription("Resumes a stopped file by uploading a new revision. Creates a new FileVersion, sends per-department notes as Notifications, and requires all departments to re-confirm.");

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
        await dbContext.SaveChangesAsync(cancellationToken);

        // Only broadcast to the targeted departments
        var departmentIds = request.DepartmentIds ?? [];

        await broadcaster.BroadcastToDepartmentsAsync(
            departmentIds,
            "Emergency_Stop",
            new { FileId = file.Id, file.FileName });

        return Results.Ok(new StopFileResponse("Stop triggered"));
    }

    // ── POST /api/files/{id}/resume (Case 1 – no new file, with per-dept notes) ──
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

        // Create per-department Notifications with individual notes
        if (request.DepartmentNotes is { Count: > 0 })
        {
            var notifications = request.DepartmentNotes.Select(dn => new Notification
            {
                DepartmentId = dn.DepartmentId,
                Title = dn.IsAffected
                    ? $"[RESUME - Có ảnh hưởng] {file.FileName}"
                    : $"[RESUME - Không ảnh hưởng] {file.FileName}",
                Message = dn.Note,
                TargetFolderId = null,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            dbContext.Notifications.AddRange(notifications);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await broadcaster.BroadcastToDepartmentsAsync(
            resumedDepartmentIds,
            "Production_Resume",
            new { FileId = file.Id, file.FileName, HasNewFile = false });

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

        var sourceVersion = await dbContext.FileVersions.FirstOrDefaultAsync(x => x.Id == versionId && x.FileId == fileId, cancellationToken);
        if (sourceVersion is null)
            return Results.NotFound("Source version not found.");

        if (string.IsNullOrWhiteSpace(request.ChangeReason))
            return Results.BadRequest("ChangeReason is required for rollback.");

        var departmentIdList = (request.DepartmentIds ?? Array.Empty<int>()).Distinct().ToList();
        if (departmentIdList.Count == 0)
            return Results.BadRequest("At least one departmentId is required.");

        var validDepartmentIds = await dbContext.Departments
            .Where(x => departmentIdList.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (validDepartmentIds.Count != departmentIdList.Count)
            return Results.BadRequest("One or more departmentIds are invalid.");

        var nextVersionNumber = await dbContext.FileVersions
            .Where(x => x.FileId == fileId)
            .Select(x => (int?)x.VersionNumber)
            .MaxAsync(cancellationToken) ?? 0;
        nextVersionNumber++;

        var newVersion = new FileVersion
        {
            FileId = fileId,
            VersionNumber = nextVersionNumber,
            FileUrl = sourceVersion.FileUrl,
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

        dbContext.Distributions.AddRange(distributions);
        await dbContext.SaveChangesAsync(cancellationToken);

        await broadcaster.BroadcastToDepartmentsAsync(
            validDepartmentIds,
            "New_Version",
            new { FileId = file.Id, file.FileName, VersionNumber = nextVersionNumber });

        return Results.Ok(new UploadFileResponse(
            file.Id,
            newVersion.Id,
            nextVersionNumber,
            newVersion.FileUrl));
    }
}
