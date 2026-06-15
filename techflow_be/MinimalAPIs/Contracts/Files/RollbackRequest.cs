namespace MinimalAPIs.Contracts.Files;

public record RollbackRequest(string ChangeReason, int[] DepartmentIds);
