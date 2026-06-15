namespace MinimalAPIs.Domain.Entities;

public class Department
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Distribution> Distributions { get; set; } = new List<Distribution>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}