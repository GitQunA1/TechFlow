namespace MinimalAPIs.Contracts.Folders;

/// <summary>DTO for a file inside a folder, including latest version info and distribution info.</summary>
public record FolderFileDto(
    int FileId,
    int FileVersionId,
    string FileName,
    bool IsStopped,
    int VersionNumber,
    string? FileUrl,
    string? ChangeReason,
    DateTime CreatedAt,
    IReadOnlyList<string> SentToDepartments,
    IReadOnlyList<string> ConfirmedByDepartments
);
