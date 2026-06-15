namespace MinimalAPIs.Domain.Entities;

public class File
{
    public int Id { get; set; }
    public int FolderId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public bool IsStopped { get; set; }
    public int[] StoppedDepartmentIds { get; set; } = [];
    public DateTime CreatedAt { get; set; }

    public Folder Folder { get; set; } = default!;
    public ICollection<FileVersion> Versions { get; set; } = new List<FileVersion>();
}