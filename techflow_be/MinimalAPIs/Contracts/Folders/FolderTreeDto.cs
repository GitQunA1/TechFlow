namespace MinimalAPIs.Contracts.Folders;

public sealed record FolderTreeDto(
    int Id,
    string Name,
    int? ParentId,
    List<FolderTreeDto> Children,
    bool HasStoppedFiles = false);