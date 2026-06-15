using Microsoft.AspNetCore.Mvc;

namespace MinimalAPIs.Contracts.Files;

public sealed class UploadFileRequest
{
    [FromForm] public int? FileId { get; set; }
    [FromForm] public int FolderId { get; set; }
    [FromForm] public IFormFile? PdfFile { get; set; }
    [FromForm] public string? ChangeReason { get; set; }
    [FromForm] public List<int> DepartmentIds { get; set; } = new();
    [FromForm] public int? RollbackFromVersionId { get; set; }
    [FromForm] public DateTime? DeadlineTime { get; set; }
}