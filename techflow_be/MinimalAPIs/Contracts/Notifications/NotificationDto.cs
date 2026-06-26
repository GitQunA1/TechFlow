namespace MinimalAPIs.Contracts.Notifications;

public sealed record NotificationDto(
    int Id,
    string Title,
    string Message,
    int? TargetFolderId,
    int? TargetFileId,
    bool IsRead,
    DateTime CreatedAt);