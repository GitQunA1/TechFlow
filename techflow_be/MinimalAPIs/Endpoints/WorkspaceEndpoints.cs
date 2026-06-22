using System.Security.Claims;
using MinimalAPIs.Contracts.Workspace;
using MinimalAPIs.Data;
using MinimalAPIs.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MinimalAPIs.Endpoints;

public static class WorkspaceEndpoints
{
    public static IEndpointRouteBuilder MapWorkspaceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/workspaces")
            .WithTags("Workspaces")
            .RequireAuthorization();

        group.MapGet("/pending-files", GetPendingFilesAsync);

        var distributionsGroup = app.MapGroup("/api/distributions")
            .WithTags("Distributions")
            .RequireAuthorization();

        distributionsGroup.MapPost("/{id:int}/confirm", ConfirmAsync);

        return app;
    }

    private static async Task<IResult> GetPendingFilesAsync(
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departmentId = GetDepartmentId(user);
        if (departmentId is null)
        {
            return Results.Forbid();
        }

        // Load all distributions for this department into memory first.
        // EF Core cannot translate GroupBy + First() with complex navigation projections
        // into a single SQL query, so we evaluate on the client side.
        var allDistributions = await dbContext.Distributions
            .AsNoTracking()
            .Include(x => x.FileVersion)
                .ThenInclude(v => v.File)
                    .ThenInclude(f => f.Folder)
                        .ThenInclude(f => f.Category)
                            .ThenInclude(c => c.Leader)
            .Where(x => x.DepartmentId == departmentId.Value)
            .ToListAsync(cancellationToken);

        // Return all distributions, sorted by newest first
        var latestDistributions = allDistributions
            .OrderByDescending(x => x.FileVersion.CreatedAt)
            .Select(x => new PendingFileDto(
                x.Id,
                x.FileVersion.FileId,
                x.FileVersion.File.FileName,
                x.FileVersion.File.FolderId,
                x.FileVersion.File.Folder.Name,
                x.FileVersion.File.Folder.CategoryId,
                x.FileVersion.File.Folder.Category.Name,
                x.FileVersion.File.Folder.Category.Leader?.Username,
                x.FileVersion.VersionNumber,
                x.FileVersion.FileUrl,
                x.FileVersion.File.IsStopped && (x.FileVersion.File.StoppedDepartmentIds != null && x.FileVersion.File.StoppedDepartmentIds.Contains(departmentId.Value)),
                x.FileVersion.ChangeReason,
                x.Status.ToString(),
                x.DeadlineTime,
                x.ConfirmedAt,
                x.FileVersion.CreatedAt,
                x.Note))
            .ToList();

        return Results.Ok(latestDistributions);
    }

    private static async Task<IResult> ConfirmAsync(
        int id,
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departmentId = GetDepartmentId(user);
        if (departmentId is null)
        {
            return Results.Forbid();
        }

        var distribution = await dbContext.Distributions.FirstOrDefaultAsync(x => x.Id == id && x.DepartmentId == departmentId.Value, cancellationToken);
        if (distribution is null)
        {
            return Results.NotFound();
        }

        distribution.Status = DistributionStatus.Confirmed;
        distribution.ConfirmedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new ConfirmDistributionResponse("Confirmed"));
    }

    private static int? GetDepartmentId(ClaimsPrincipal user)
    {
        var departmentValue = user.FindFirstValue("departmentId");
        return int.TryParse(departmentValue, out var departmentId) ? departmentId : null;
    }
}