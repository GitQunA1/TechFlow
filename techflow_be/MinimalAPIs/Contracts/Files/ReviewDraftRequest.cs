namespace MinimalAPIs.Contracts.Files;

public record ReviewDraftRequest(bool Approve, string? RejectReason);
