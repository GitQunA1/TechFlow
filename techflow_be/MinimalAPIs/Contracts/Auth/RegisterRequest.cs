using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Contracts.Auth;

public sealed class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public int? CategoryId { get; set; }
    public int? DepartmentId { get; set; }
}