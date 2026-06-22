namespace MinimalAPIs.Contracts.Admin;

public record AdminCategoryDto(
    int Id,
    string Name,
    int? LeaderId,
    string? LeaderUsername
);
