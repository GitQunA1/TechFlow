namespace MinimalAPIs.Contracts.Files;

public sealed record UploadFileResponse(
    int FileId,
    int FileVersionId,
    int VersionNumber,
    string FileUrl);