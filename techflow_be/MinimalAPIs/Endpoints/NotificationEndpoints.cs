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
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

        var departmentId = GetDepartmentId(user);

        var notifications = await dbContext.Notifications
            .AsNoTracking()
            .Where(x => (departmentId.HasValue && x.DepartmentId == departmentId.Value) || x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new NotificationDto(
                x.Id,
                x.Title,
                x.Message,
                x.TargetFolderId,
                x.TargetFileId,
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
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

        var departmentId = GetDepartmentId(user);

        var notification = await dbContext.Notifications.FirstOrDefaultAsync(
            x => x.Id == id && ((departmentId.HasValue && x.DepartmentId == departmentId.Value) || x.UserId == userId), 
            cancellationToken);
            
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
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

        var departmentId = GetDepartmentId(user);

        await dbContext.Notifications
            .Where(x => ((departmentId.HasValue && x.DepartmentId == departmentId.Value) || x.UserId == userId) && !x.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true), cancellationToken);

        return Results.Ok(new { message = "All marked as read" });
    }

    private static async Task<IResult> DeleteNotificationAsync(
        int id,
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

        var departmentId = GetDepartmentId(user);

        var rows = await dbContext.Notifications
            .Where(x => x.Id == id && ((departmentId.HasValue && x.DepartmentId == departmentId.Value) || x.UserId == userId))
            .ExecuteDeleteAsync(cancellationToken);

        return rows > 0 ? Results.Ok(new { message = "Deleted" }) : Results.NotFound();
    }

    private static async Task<IResult> DeleteAllNotificationsAsync(
        ClaimsPrincipal user,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(currentUserId, out var userId)) return Results.Unauthorized();

        var departmentId = GetDepartmentId(user);

        await dbContext.Notifications
            .Where(x => (departmentId.HasValue && x.DepartmentId == departmentId.Value) || x.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);

        return Results.Ok(new { message = "All deleted" });
    }

    private static int? GetDepartmentId(ClaimsPrincipal user)
    {
        var departmentValue = user.FindFirstValue("departmentId");
        return int.TryParse(departmentValue, out var departmentId) ? departmentId : null;
    }
}