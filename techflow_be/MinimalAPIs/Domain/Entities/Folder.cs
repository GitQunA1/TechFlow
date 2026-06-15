namespace MinimalAPIs.Domain.Entities;

public class Folder
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public int CategoryId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Folder? Parent { get; set; }
    public ICollection<Folder> Children { get; set; } = new List<Folder>();
    public Category Category { get; set; } = default!;
    public ICollection<File> Files { get; set; } = new List<File>();
}