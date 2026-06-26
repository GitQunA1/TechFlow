namespace MinimalAPIs.Domain.Entities;

public class Notification
{
    public int Id { get; set; }
    public int DepartmentId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int? TargetFolderId { get; set; }
    public int? TargetFileId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    public Department Department { get; set; } = default!;
    public Folder? TargetFolder { get; set; }
}