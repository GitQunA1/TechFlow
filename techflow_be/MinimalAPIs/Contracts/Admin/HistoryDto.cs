namespace MinimalAPIs.Contracts.Admin;

public record HistoryDto(
    int DistributionId,
    string FileName,
    int VersionNumber,
    string FolderName,
    string CategoryName,
    string UploaderName,
    DateTime UploadedAt,
    string DepartmentName,
    DateTime? ConfirmedAt,
    string Status,
    bool IsStopped
);
