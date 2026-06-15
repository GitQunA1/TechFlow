using MinimalAPIs.Contracts.Departments;
using MinimalAPIs.Data;
using Microsoft.EntityFrameworkCore;

namespace MinimalAPIs.Endpoints;

public static class DepartmentsEndpoints
{
    public static IEndpointRouteBuilder MapDepartmentsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/departments")
            .WithTags("Departments")
            .RequireAuthorization();

        group.MapGet("", GetDepartmentsAsync);

        return app;
    }

    private static async Task<IResult> GetDepartmentsAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departments = await dbContext.Departments
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new DepartmentDto(x.Id, x.Code, x.Name))
            .ToListAsync(cancellationToken);

        return Results.Ok(departments);
    }
}