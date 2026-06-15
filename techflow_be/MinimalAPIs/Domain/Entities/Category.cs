namespace MinimalAPIs.Domain.Entities;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? LeaderId { get; set; }

    public User? Leader { get; set; }
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Folder> Folders { get; set; } = new List<Folder>();
}