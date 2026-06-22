namespace MinimalAPIs.Contracts.Admin;

public record OverdueAlertDto(
    int DistributionId,
    string DepartmentName,
    string FileName,
    int VersionNumber,
    string CategoryName,
    DateTime Deadline,
    double HoursOverdue
);

public record DashboardStatsDto(
    int TotalActiveFiles,
    double ConfirmationRate,
    int TotalConfirmed,
    int TotalPending,
    int TotalOverdue,
    IReadOnlyList<OverdueAlertDto> OverdueAlerts
);
