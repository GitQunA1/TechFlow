namespace MinimalAPIs.Contracts.Departments;

public sealed record DepartmentDto(
    int Id,
    string Code,
    string Name);