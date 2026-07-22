namespace MinimalAPIs.Contracts.Files;

public record DraftFileDto(
    int Id,
    int FolderId,
    string FolderName,
    string? ParentFolderName,
    int CategoryId,
    string CategoryName,
    string FileName,
    string? FileUrl,
    string Status,
    string? RejectReason,
    string UploadedBy,
    DateTime CreatedAt,
    int[] DepartmentIds);
