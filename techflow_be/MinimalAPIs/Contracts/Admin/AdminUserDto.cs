namespace MinimalAPIs.Contracts.Admin;

public record AdminUserDto(
    int Id,
    string Username,
    string Role,
    int? CategoryId,
    string? CategoryName,
    int? DepartmentId,
    string? DepartmentName
);
