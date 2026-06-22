using MinimalAPIs.Domain.Enums;

namespace MinimalAPIs.Domain.Entities;

public class Distribution
{
    public int Id { get; set; }
    public int FileVersionId { get; set; }
    public int DepartmentId { get; set; }
    public DistributionStatus Status { get; set; }
    public DateTime? DeadlineTime { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public string? Note { get; set; }

    public FileVersion FileVersion { get; set; } = default!;
    public Department Department { get; set; } = default!;
}