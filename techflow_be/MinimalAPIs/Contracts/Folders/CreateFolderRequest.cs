namespace MinimalAPIs.Contracts.Folders;

public sealed class CreateFolderRequest
{
    public string Name { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public int? ParentId { get; set; }
}