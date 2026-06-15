namespace MinimalAPIs.Contracts.Notifications;

public sealed record NotificationDto(
    int Id,
    string Title,
    string Message,
    int? TargetFolderId,
    bool IsRead,
    DateTime CreatedAt);