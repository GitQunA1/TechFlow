namespace MinimalAPIs.Contracts.Files;

public record CreateRevisionRequest(string? Message, int? AssignedStaffId);

public record RejectRevisionRequest(string Reason);
