namespace MinimalAPIs.Contracts.Auth;

public sealed record LoginResponse(
    string Token,
    int UserId,
    string Role,
    int? CategoryId,
    int? DepartmentId);