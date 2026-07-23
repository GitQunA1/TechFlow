using MinimalAPIs.Domain.Enums;
using FileEntity = MinimalAPIs.Domain.Entities.File;

namespace MinimalAPIs.Domain.Entities;

public class StaffRevisionRequest
{
    public int Id { get; set; }
    public int FileId { get; set; }               // File đang Stop
    public int RequestedById { get; set; }        // Leader user ID
    public string? Message { get; set; } // Nội dung yêu cầu chỉnh sửa
    public RevisionStatus Status { get; set; } = RevisionStatus.Pending;
    public int? AssignedStaffId { get; set; }     // Staff được giao nhiệm vụ
    public string? SubmittedFileUrl { get; set; } // File URL mới Staff upload
    public string? SubmittedFileName { get; set; } // File name mới Staff upload
    public string? SubmittedNote { get; set; }    // Note của Staff khi submit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }    // Khi Staff submit file mới

    // Navigation
    public FileEntity File { get; set; } = null!;
    public User RequestedBy { get; set; } = null!;
    public User? AssignedStaff { get; set; }
}
