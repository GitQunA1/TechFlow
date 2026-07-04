namespace MinimalAPIs.Contracts.Files;

/// <summary>
/// JSON body cho API POST /api/files/upload-by-path
/// Thay thế hoàn toàn multipart/form-data + IFormFile cũ.
/// </summary>
public sealed class UploadFileByPathRequest
{
    public int FolderId { get; set; }
    /// <summary>Tên file kèm đuôi, ví dụ: banve_tang1.dwg</summary>
    public string FileName { get; set; } = string.Empty;
    /// <summary>Danh sách phòng ban nhận bản vẽ</summary>
    public List<int> DepartmentIds { get; set; } = new();
}