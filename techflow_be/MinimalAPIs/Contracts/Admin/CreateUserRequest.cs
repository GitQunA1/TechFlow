using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Contracts.Admin;

public record CreateUserRequest(
    string Username,
    string Password,
    UserRole Role,
    int? CategoryId,
    int? DepartmentId
);
