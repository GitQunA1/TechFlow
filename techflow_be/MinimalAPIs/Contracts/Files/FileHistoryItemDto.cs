namespace MinimalAPIs.Contracts.Files;

public sealed record FileHistoryItemDto(
    int FileVersionId,
    int VersionNumber,
    string? FileUrl,
    string? ChangeReason,
    string UploadedBy,
    DateTime CreatedAt);