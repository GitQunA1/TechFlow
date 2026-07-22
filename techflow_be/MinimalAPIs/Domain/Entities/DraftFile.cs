using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Domain.Entities;

public class DraftFile
{
    public int Id { get; set; }
    public int FolderId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? FileUrl { get; set; }         // Physical path /uploads/...
    public int UploadedById { get; set; }         // Staff user ID
    public int[] DepartmentIds { get; set; } = Array.Empty<int>(); // Pre-selected departments
    public DraftStatus Status { get; set; } = DraftStatus.Pending;
    public string? RejectReason { get; set; }     // Filled by Leader when rejecting
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedById { get; set; }        // Leader/Admin who reviewed

    // Navigation
    public Folder Folder { get; set; } = null!;
    public User UploadedBy { get; set; } = null!;
    public User? ReviewedBy { get; set; }
}
