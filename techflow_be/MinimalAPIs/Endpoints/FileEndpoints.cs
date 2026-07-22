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
    // ── Validate đuôi file chỉ cho phép .png .jpg .jpeg .pdf .dwg ────────────
    private static bool IsValidExtension(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".png" or ".jpg" or ".jpeg" or ".pdf" or ".dwg";
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
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            // ── Validation ────────────────────────────────────────────────
            if (folderId <= 0)
                return Results.BadRequest("FolderId is required.");

            if (file == null || file.Length == 0)
                return Results.BadRequest("File is required.");

            if (!IsValidExtension(file.FileName))
                return Results.BadRequest("Only .png, .jpg, .jpeg, .pdf, and .dwg files are allowed.");

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

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);

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

            // ── Staff → create Draft, Leader/Admin → publish directly ──────
            if (currentUser.Role == UserRole.Staff)
            {
                var folder = await dbContext.Folders
                    .Include(f => f.Category)
                    .FirstOrDefaultAsync(x => x.Id == folderId, cancellationToken);

                var draft = new DraftFile
                {
                    FolderId = folderId,
                    FileName = originalFileName,
                    FileUrl = fileUrl,
                    UploadedById = userId,
                    DepartmentIds = departmentIdList.ToArray(),
                    Status = DraftStatus.Pending,
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.DraftFiles.Add(draft);
                await dbContext.SaveChangesAsync(cancellationToken);

                // Notify leaders/admins about new pending draft
                await broadcaster.BroadcastToLeadersAsync("NewDraftNotification", new
                {
                    DraftId = draft.Id,
                    draft.FileName,
                    FolderName = folder?.Name ?? "",
                    UploadedBy = currentUser.Username
                });
                await broadcaster.BroadcastToAdminsAsync("NewDraftNotification", new
                {
                    DraftId = draft.Id,
                    draft.FileName,
                    FolderName = folder?.Name ?? "",
                    UploadedBy = currentUser.Username
                });

                return Results.Ok(new { DraftId = draft.Id, Message = "Draft created. Waiting for leader approval." });
            }

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

        // ── Draft workflow endpoints ───────────────────────────────────────

        // GET /api/files/drafts — Staff gets own drafts
        group.MapGet("/drafts", async (
            ClaimsPrincipal user,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Staff) return Results.Forbid();

            var drafts = await dbContext.DraftFiles
                .AsNoTracking()
                .Include(d => d.Folder).ThenInclude(f => f.Parent)
                .Include(d => d.Folder).ThenInclude(f => f.Category)
                .Where(d => d.UploadedById == userId)
                .OrderByDescending(d => d.CreatedAt)
                .Select(d => new DraftFileDto(
                    d.Id,
                    d.FolderId,
                    d.Folder.Name,
                    d.Folder.Parent != null ? d.Folder.Parent.Name : null,
                    d.Folder.CategoryId,
                    d.Folder.Category.Name,
                    d.FileName,
                    d.FileUrl,
                    d.Status.ToString(),
                    d.RejectReason,
                    d.UploadedBy.Username,
                    d.CreatedAt,
                    d.DepartmentIds))
                .ToListAsync(cancellationToken);

            return Results.Ok(drafts);
        });

        // GET /api/files/drafts/pending — Leader/Admin gets all pending drafts
        group.MapGet("/drafts/pending", async (
            ClaimsPrincipal user,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users
                .Include(u => u.LedCategories)
                .FirstAsync(x => x.Id == userId, cancellationToken);

            if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
                return Results.Forbid();

            IQueryable<DraftFile> query = dbContext.DraftFiles
                .AsNoTracking()
                .Include(d => d.Folder).ThenInclude(f => f.Parent)
                .Include(d => d.Folder).ThenInclude(f => f.Category)
                .Include(d => d.UploadedBy)
                .Where(d => d.Status == DraftStatus.Pending);

            // Leader chỉ thấy drafts thuộc categories của mình
            if (currentUser.Role == UserRole.TechLeader)
            {
                var ledCategoryIds = currentUser.LedCategories.Select(c => c.Id).ToList();
                query = query.Where(d => ledCategoryIds.Contains(d.Folder.CategoryId));
            }

            var drafts = await query
                .OrderByDescending(d => d.CreatedAt)
                .Select(d => new DraftFileDto(
                    d.Id,
                    d.FolderId,
                    d.Folder.Name,
                    d.Folder.Parent != null ? d.Folder.Parent.Name : null,
                    d.Folder.CategoryId,
                    d.Folder.Category.Name,
                    d.FileName,
                    d.FileUrl,
                    d.Status.ToString(),
                    d.RejectReason,
                    d.UploadedBy.Username,
                    d.CreatedAt,
                    d.DepartmentIds))
                .ToListAsync(cancellationToken);

            return Results.Ok(drafts);
        });

        // POST /api/files/drafts/{id}/review — Leader/Admin approves or rejects
        group.MapPost("/drafts/{id:int}/review", async (
            int id,
            [FromBody] ReviewDraftRequest request,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
                return Results.Forbid();

            var draft = await dbContext.DraftFiles
                .Include(d => d.Folder).ThenInclude(f => f.Category)
                .Include(d => d.UploadedBy)
                .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

            if (draft is null) return Results.NotFound("Draft not found.");
            if (draft.Status != DraftStatus.Pending)
                return Results.BadRequest("Draft is already reviewed.");

            draft.ReviewedById = userId;
            draft.ReviewedAt = DateTime.UtcNow;

            if (!request.Approve)
            {
                // ── REJECT ──────────────────────────────────────────────
                draft.Status = DraftStatus.Rejected;
                draft.RejectReason = request.RejectReason ?? "No reason provided.";
                await dbContext.SaveChangesAsync(cancellationToken);

                // Notify the staff
                await broadcaster.BroadcastToStaffAsync(draft.UploadedById, "DraftRejected", new
                {
                    DraftId = draft.Id,
                    draft.FileName,
                    RejectReason = draft.RejectReason
                });

                return Results.Ok(new { Message = "Draft rejected." });
            }

            // ── APPROVE ──────────────────────────────────────────────────
            draft.Status = DraftStatus.Approved;

            var departmentIdList = draft.DepartmentIds.ToList();

            // Resolve or create File record
            FileEntity? fileRecord = await dbContext.Files
                .FirstOrDefaultAsync(x => x.FolderId == draft.FolderId, cancellationToken);

            if (fileRecord is null)
            {
                fileRecord = new FileEntity
                {
                    FolderId = draft.FolderId,
                    FileName = draft.FileName,
                    IsStopped = false,
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.Files.Add(fileRecord);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            // Next version number
            var nextVersionNumber = await dbContext.FileVersions
                .Where(x => x.FileId == fileRecord.Id)
                .Select(x => (int?)x.VersionNumber)
                .MaxAsync(cancellationToken) ?? 0;

            // Insert FileVersion
            var fileVersion = new FileVersion
            {
                FileId = fileRecord.Id,
                FileName = draft.FileName,
                VersionNumber = nextVersionNumber + 1,
                FileUrl = draft.FileUrl,
                ChangeReason = "Approved staff draft",
                UploadedById = draft.UploadedById,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.FileVersions.Add(fileVersion);
            await dbContext.SaveChangesAsync(cancellationToken);

            // Insert Distributions & Notifications
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
                TargetFolderId = draft.FolderId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            dbContext.Distributions.AddRange(distributions);
            dbContext.Notifications.AddRange(notifications);
            await dbContext.SaveChangesAsync(cancellationToken);

            // Broadcast to departments and staff
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
            await broadcaster.BroadcastToStaffAsync(draft.UploadedById, "DraftApproved", new
            {
                DraftId = draft.Id,
                draft.FileName,
                FileId = fileRecord.Id,
                fileVersion.VersionNumber
            });

            return Results.Ok(new UploadFileResponse(
                fileRecord.Id,
                fileVersion.Id,
                fileVersion.VersionNumber,
                fileVersion.FileUrl));
        });

        // POST /api/files/drafts/{id}/resubmit — Staff re-uploads rejected draft
        group.MapPost("/drafts/{id:int}/resubmit", async (
            int id,
            IFormFile file,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Staff) return Results.Forbid();

            var draft = await dbContext.DraftFiles
                .Include(d => d.Folder).ThenInclude(f => f.Category)
                .FirstOrDefaultAsync(d => d.Id == id && d.UploadedById == userId, cancellationToken);

            if (draft is null) return Results.NotFound("Draft not found.");
            if (draft.Status != DraftStatus.Rejected)
                return Results.BadRequest("Only rejected drafts can be resubmitted.");

            if (file == null || file.Length == 0)
                return Results.BadRequest("File is required.");

            if (!IsValidExtension(file.FileName))
                return Results.BadRequest("Only .png, .jpg, .jpeg, .pdf, and .dwg files are allowed.");

            // Save new file
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var originalFileName = Path.GetFileName(file.FileName);
            var uniqueFileName = $"{Guid.NewGuid():N}_{originalFileName}";
            var physicalFilePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(physicalFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            draft.FileUrl = $"/uploads/{uniqueFileName}";
            draft.FileName = originalFileName;
            draft.Status = DraftStatus.Pending;
            draft.RejectReason = null;
            draft.ReviewedById = null;
            draft.ReviewedAt = null;

            await dbContext.SaveChangesAsync(cancellationToken);

            // Notify leaders
            await broadcaster.BroadcastToLeadersAsync("NewDraftNotification", new
            {
                DraftId = draft.Id,
                draft.FileName,
                FolderName = draft.Folder?.Name ?? "",
                UploadedBy = currentUser.Username,
                IsResubmission = true
            });
            await broadcaster.BroadcastToAdminsAsync("NewDraftNotification", new
            {
                DraftId = draft.Id,
                draft.FileName,
                FolderName = draft.Folder?.Name ?? "",
                UploadedBy = currentUser.Username,
                IsResubmission = true
            });

            return Results.Ok(new { Message = "Draft resubmitted successfully." });
        })
        .DisableAntiforgery();

        // ── Revision Request workflow endpoints ───────────────────────────

        // POST /api/files/{id}/revision-request — Leader creates revision request for staff
        group.MapPost("/{id:int}/revision-request", async (
            int id,
            [FromBody] CreateRevisionRequest request,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
                return Results.Forbid();

            if (string.IsNullOrWhiteSpace(request.Message))
                return Results.BadRequest("Message is required.");

            var file = await dbContext.Files.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
            if (file is null) return Results.NotFound("File not found.");

            if (!file.IsStopped)
                return Results.BadRequest("File is not stopped. Only stopped files can have revision requests.");

            // Check for existing pending/submitted request
            var existingRequest = await dbContext.StaffRevisionRequests
                .AnyAsync(r => r.FileId == id && (r.Status == RevisionStatus.Pending || r.Status == RevisionStatus.Submitted), cancellationToken);
            if (existingRequest)
                return Results.BadRequest("There is already an active revision request for this file.");

            var revisionRequest = new StaffRevisionRequest
            {
                FileId = id,
                RequestedById = userId,
                Message = request.Message,
                AssignedStaffId = request.AssignedStaffId,
                Status = RevisionStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.StaffRevisionRequests.Add(revisionRequest);
            await dbContext.SaveChangesAsync(cancellationToken);

            // Notify assigned staff or all staff
            if (request.AssignedStaffId.HasValue)
            {
                await broadcaster.BroadcastToStaffAsync(request.AssignedStaffId.Value, "RevisionRequested", new
                {
                    RevisionId = revisionRequest.Id,
                    FileId = id,
                    file.FileName,
                    request.Message,
                    RequestedBy = currentUser.Username
                });
            }
            else
            {
                await broadcaster.BroadcastToAllStaffAsync("RevisionRequested", new
                {
                    RevisionId = revisionRequest.Id,
                    FileId = id,
                    file.FileName,
                    request.Message,
                    RequestedBy = currentUser.Username
                });
            }

            return Results.Ok(new { RevisionId = revisionRequest.Id, Message = "Revision request sent to staff." });
        });

        // GET /api/files/revision-requests — Staff gets their revision tasks
        group.MapGet("/revision-requests", async (
            ClaimsPrincipal user,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Staff) return Results.Forbid();

            var requests = await dbContext.StaffRevisionRequests
                .AsNoTracking()
                .Include(r => r.File).ThenInclude(f => f.Folder).ThenInclude(f => f.Category)
                .Include(r => r.RequestedBy)
                .Include(r => r.AssignedStaff)
                .Where(r => r.AssignedStaffId == userId || r.AssignedStaffId == null)
                .Where(r => r.Status != RevisionStatus.Approved)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new StaffRevisionRequestDto(
                    r.Id,
                    r.FileId,
                    r.File.FileName,
                    r.File.Folder.Name,
                    r.File.Folder.Category.Name,
                    r.Message,
                    r.Status.ToString(),
                    r.RequestedBy.Username,
                    r.CreatedAt,
                    r.SubmittedFileUrl,
                    r.SubmittedFileName,
                    r.SubmittedAt,
                    r.AssignedStaffId,
                    r.AssignedStaff != null ? r.AssignedStaff.Username : null))
                .ToListAsync(cancellationToken);

            return Results.Ok(requests);
        });

        // GET /api/files/revision-requests/pending — Leader gets pending revision requests
        group.MapGet("/revision-requests/pending", async (
            ClaimsPrincipal user,
            AppDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
                return Results.Forbid();

            var requests = await dbContext.StaffRevisionRequests
                .AsNoTracking()
                .Include(r => r.File).ThenInclude(f => f.Folder).ThenInclude(f => f.Category)
                .Include(r => r.RequestedBy)
                .Include(r => r.AssignedStaff)
                .Where(r => r.Status == RevisionStatus.Submitted)
                .OrderByDescending(r => r.SubmittedAt)
                .Select(r => new StaffRevisionRequestDto(
                    r.Id,
                    r.FileId,
                    r.File.FileName,
                    r.File.Folder.Name,
                    r.File.Folder.Category.Name,
                    r.Message,
                    r.Status.ToString(),
                    r.RequestedBy.Username,
                    r.CreatedAt,
                    r.SubmittedFileUrl,
                    r.SubmittedFileName,
                    r.SubmittedAt,
                    r.AssignedStaffId,
                    r.AssignedStaff != null ? r.AssignedStaff.Username : null))
                .ToListAsync(cancellationToken);

            return Results.Ok(requests);
        });

        // POST /api/files/revision-requests/{id}/submit — Staff submits revised file
        group.MapPost("/revision-requests/{id:int}/submit", async (
            int id,
            IFormFile file,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Staff) return Results.Forbid();

            var revisionRequest = await dbContext.StaffRevisionRequests
                .Include(r => r.File)
                .FirstOrDefaultAsync(r => r.Id == id && (r.AssignedStaffId == userId || r.AssignedStaffId == null), cancellationToken);

            if (revisionRequest is null) return Results.NotFound("Revision request not found.");
            if (revisionRequest.Status != RevisionStatus.Pending)
                return Results.BadRequest("This revision request is not in Pending state.");

            if (file == null || file.Length == 0)
                return Results.BadRequest("File is required.");

            if (!IsValidExtension(file.FileName))
                return Results.BadRequest("Only .png, .jpg, .jpeg, .pdf, and .dwg files are allowed.");

            // Save physical file
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var originalFileName = Path.GetFileName(file.FileName);
            var uniqueFileName = $"{Guid.NewGuid():N}_{originalFileName}";
            var physicalFilePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(physicalFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            revisionRequest.SubmittedFileUrl = $"/uploads/{uniqueFileName}";
            revisionRequest.SubmittedFileName = originalFileName;
            revisionRequest.Status = RevisionStatus.Submitted;
            revisionRequest.SubmittedAt = DateTime.UtcNow;

            await dbContext.SaveChangesAsync(cancellationToken);

            // Notify the leader who created the request
            await broadcaster.BroadcastToUserAsync(revisionRequest.RequestedById, "RevisionSubmitted", new
            {
                RevisionId = revisionRequest.Id,
                FileId = revisionRequest.FileId,
                revisionRequest.File.FileName,
                SubmittedBy = currentUser.Username
            });
            await broadcaster.BroadcastToAdminsAsync("RevisionSubmitted", new
            {
                RevisionId = revisionRequest.Id,
                FileId = revisionRequest.FileId,
                revisionRequest.File.FileName,
                SubmittedBy = currentUser.Username
            });

            return Results.Ok(new { Message = "Revision file submitted. Waiting for leader approval." });
        })
        .DisableAntiforgery();

        // POST /api/files/revision-requests/{id}/approve — Leader approves revision → Resume file
        group.MapPost("/revision-requests/{id:int}/approve", async (
            int id,
            [FromBody] ResumeRequest? request,
            ClaimsPrincipal user,
            AppDbContext dbContext,
            NotificationBroadcaster broadcaster,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

            var currentUser = await dbContext.Users.FirstAsync(x => x.Id == userId, cancellationToken);
            if (currentUser.Role != UserRole.Admin && currentUser.Role != UserRole.TechLeader)
                return Results.Forbid();

            var revisionRequest = await dbContext.StaffRevisionRequests
                .Include(r => r.File)
                .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

            if (revisionRequest is null) return Results.NotFound("Revision request not found.");
            if (revisionRequest.Status != RevisionStatus.Submitted)
                return Results.BadRequest("Revision request must be in Submitted state to approve.");

            var fileRecord = revisionRequest.File;
            if (!fileRecord.IsStopped)
                return Results.BadRequest("The file is no longer stopped.");

            // Create new FileVersion from submitted file
            var nextVersionNumber = await dbContext.FileVersions
                .Where(x => x.FileId == fileRecord.Id)
                .Select(x => (int?)x.VersionNumber)
                .MaxAsync(cancellationToken) ?? 0;

            var fileVersion = new FileVersion
            {
                FileId = fileRecord.Id,
                FileName = revisionRequest.SubmittedFileName ?? fileRecord.FileName,
                VersionNumber = nextVersionNumber + 1,
                FileUrl = revisionRequest.SubmittedFileUrl,
                ChangeReason = "Staff revision approved",
                UploadedById = revisionRequest.AssignedStaffId ?? userId,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.FileVersions.Add(fileVersion);

            // Resume the file
            var resumedDepartmentIds = fileRecord.StoppedDepartmentIds.ToList();
            fileRecord.IsStopped = false;
            fileRecord.StoppedDepartmentIds = [];

            revisionRequest.Status = RevisionStatus.Approved;

            await dbContext.SaveChangesAsync(cancellationToken);

            // Create distributions for previously stopped departments
            var notesList = request?.DepartmentNotes ?? new List<DepartmentNoteDto>();

            if (resumedDepartmentIds.Any())
            {
                var distributions = resumedDepartmentIds.Select(deptId => new Distribution
                {
                    FileVersionId = fileVersion.Id,
                    DepartmentId = deptId,
                    Status = DistributionStatus.Pending,
                    DeadlineTime = DateTime.UtcNow.AddHours(24),
                    ConfirmedAt = null
                }).ToList();

                var notifications = resumedDepartmentIds.Select(deptId =>
                {
                    var note = notesList.FirstOrDefault(n => n.DepartmentId == deptId);
                    return new Notification
                    {
                        DepartmentId = deptId,
                        Title = note?.IsAffected == true
                            ? $"[RESUME + Revision mới - Có ảnh hưởng] {fileVersion.FileName} v{fileVersion.VersionNumber}"
                            : $"[RESUME + Revision mới - Không ảnh hưởng] {fileVersion.FileName} v{fileVersion.VersionNumber}",
                        Message = note?.Note ?? "File has been resumed with a new revision from staff.",
                        TargetFolderId = fileRecord.FolderId,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    };
                }).ToList();

                dbContext.Distributions.AddRange(distributions);
                dbContext.Notifications.AddRange(notifications);
                await dbContext.SaveChangesAsync(cancellationToken);

                await broadcaster.BroadcastToDepartmentsAsync(resumedDepartmentIds, "Production_Resume", new
                {
                    FileId = fileRecord.Id,
                    FileName = fileVersion.FileName,
                    fileVersion.VersionNumber,
                    HasNewFile = true
                });
            }

            await broadcaster.BroadcastToAdminsAsync("Production_Resume", new
            {
                FileId = fileRecord.Id,
                FileName = fileVersion.FileName,
                fileVersion.VersionNumber,
                HasNewFile = true
            });

            // Notify the staff member
            if (revisionRequest.AssignedStaffId.HasValue)
            {
                await broadcaster.BroadcastToStaffAsync(revisionRequest.AssignedStaffId.Value, "RevisionApproved", new
                {
                    RevisionId = revisionRequest.Id,
                    FileId = fileRecord.Id,
                    fileRecord.FileName,
                    fileVersion.VersionNumber
                });
            }

            return Results.Ok(new UploadFileResponse(
                fileRecord.Id,
                fileVersion.Id,
                fileVersion.VersionNumber,
                fileVersion.FileUrl));
        });

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
                return Results.BadRequest("Only .png, .jpg, .jpeg, .pdf, and .dwg files are allowed.");

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
