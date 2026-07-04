namespace MinimalAPIs.Domain.Entities;

public class FileVersion
{
    public int Id { get; set; }
    public int FileId { get; set; }
    public int VersionNumber { get; set; }
    public string FileName { get; set; } = string.Empty;
    /// <summary>Tên file kèm đuôi, ví dụ: banve_tang1.dwg</summary>
    public string? FilePath { get; set; }
    /// <summary>FileUrl giữ nguyên để không phá vỡ migration cũ — luôn là null với hệ thống mới</summary>
    public string? FileUrl { get; set; }
    public string? ChangeReason { get; set; }
    public int UploadedById { get; set; }
    public DateTime CreatedAt { get; set; }

    public File File { get; set; } = default!;
    public User UploadedBy { get; set; } = default!;
    public ICollection<Distribution> Distributions { get; set; } = new List<Distribution>();
}