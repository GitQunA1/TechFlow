namespace MinimalAPIs.Contracts.Workspace;

public sealed record PendingFileDto(
    int DistributionId,
    int FileId,
    string FileName,
    int FolderId,
    string FolderName,
    int CategoryId,
    string CategoryName,
    string? CategoryLeader,
    int VersionNumber,
    string FileUrl,
    bool IsStopped,
    string? ChangeReason,
    string Status,
    DateTime? DeadlineTime,
    DateTime? ConfirmedAt,
    DateTime CreatedAt);