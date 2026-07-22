namespace MinimalAPIs.Contracts.Files;

public record StaffRevisionRequestDto(
    int Id,
    int FileId,
    string FileName,
    string FolderName,
    string CategoryName,
    string Message,
    string Status,
    string RequestedBy,
    DateTime CreatedAt,
    string? SubmittedFileUrl,
    string? SubmittedFileName,
    DateTime? SubmittedAt,
    int? AssignedStaffId,
    string? AssignedStaffName);
