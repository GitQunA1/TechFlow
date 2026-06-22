using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Contracts.Admin;

public record UpdateUserRequest(
    string? Username,
    string? NewPassword,
    UserRole? Role,
    int? CategoryId,
    int? DepartmentId
);
