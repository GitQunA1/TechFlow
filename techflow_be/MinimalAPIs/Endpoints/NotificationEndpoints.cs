using System.Security.Claims;
using MinimalAPIs.Contracts.Common;
using MinimalAPIs.Contracts.Notifications;
using MinimalAPIs.Data;
using Microsoft.EntityFrameworkCore;

namespace MinimalAPIs.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/notifications")
            .WithTags("Notifications")
            .RequireAuthorization();

        group.MapGet("", GetNotificationsAsync);
        group.MapPut("/{id:int}/read", MarkAsReadAsync);
        group.MapPut("/read-all", MarkAllAsReadAsync);
        group.MapDelete("/{id:int}", DeleteNotificationAsync);
        group.MapDelete("/all", DeleteAllNotificationsAsync);

        return app;
    }

    private static async Task<IResult> GetNotificationsAsync(
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departmentId = GetDepartmentId(user);
        if (departmentId is null)
        {
            return Results.Forbid();
        }

        var notifications = await dbContext.Notifications
            .AsNoTracking()
            .Where(x => x.DepartmentId == departmentId.Value)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new NotificationDto(
                x.Id,
                x.Title,
                x.Message,
                x.TargetFolderId,
                x.IsRead,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(notifications);
    }

    private static async Task<IResult> MarkAsReadAsync(
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

        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.DepartmentId == departmentId.Value, cancellationToken);
        if (notification is null)
        {
            return Results.NotFound();
        }

        notification.IsRead = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new NotificationReadResponse("Success"));
    }

    private static async Task<IResult> MarkAllAsReadAsync(
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departmentId = GetDepartmentId(user);
        if (departmentId is null) return Results.Forbid();

        await dbContext.Notifications
            .Where(x => x.DepartmentId == departmentId.Value && !x.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true), cancellationToken);

        return Results.Ok(new { message = "All marked as read" });
    }

    private static async Task<IResult> DeleteNotificationAsync(
        int id,
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departmentId = GetDepartmentId(user);
        if (departmentId is null) return Results.Forbid();

        var rows = await dbContext.Notifications
            .Where(x => x.Id == id && x.DepartmentId == departmentId.Value)
            .ExecuteDeleteAsync(cancellationToken);

        return rows > 0 ? Results.Ok(new { message = "Deleted" }) : Results.NotFound();
    }

    private static async Task<IResult> DeleteAllNotificationsAsync(
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var departmentId = GetDepartmentId(user);
        if (departmentId is null) return Results.Forbid();

        await dbContext.Notifications
            .Where(x => x.DepartmentId == departmentId.Value)
            .ExecuteDeleteAsync(cancellationToken);

        return Results.Ok(new { message = "All deleted" });
    }

    private static int? GetDepartmentId(ClaimsPrincipal user)
    {
        var departmentValue = user.FindFirstValue("departmentId");
        return int.TryParse(departmentValue, out var departmentId) ? departmentId : null;
    }
}