using MinimalAPIs.Contracts.Categories;
using MinimalAPIs.Data;
using Microsoft.EntityFrameworkCore;

namespace MinimalAPIs.Endpoints;

public static class CategoryEndpoints
{
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/categories")
            .WithTags("Categories")
            .RequireAuthorization();

        group.MapGet("", GetCategoriesAsync);

        return app;
    }

    private static async Task<IResult> GetCategoriesAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var categories = await dbContext.Categories
            .AsNoTracking()
            .Include(x => x.Users)
            .OrderBy(x => x.Name)
            .Select(x => new CategoryDto(
                x.Id,
                x.Name,
                x.Users.Any() ? string.Join(", ", x.Users.OrderBy(u => u.Username).Select(u => u.Username)) : null))
            .ToListAsync(cancellationToken);

        return Results.Ok(categories);
    }
}
