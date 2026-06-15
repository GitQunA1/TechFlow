namespace MinimalAPIs.Contracts.Folders;

public sealed record CreateFolderResponse(
    int Id,
    string Name,
    int? ParentId);