using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public int? CategoryId { get; set; }
    public int? DepartmentId { get; set; }

    public Category? Category { get; set; }
    public Department? Department { get; set; }
    public ICollection<Category> LedCategories { get; set; } = new List<Category>();
    public ICollection<FileVersion> UploadedFileVersions { get; set; } = new List<FileVersion>();
}