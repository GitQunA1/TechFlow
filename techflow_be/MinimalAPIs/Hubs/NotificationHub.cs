using Microsoft.AspNetCore.SignalR;

namespace MinimalAPIs.Hubs;

/// <summary>
/// SignalR hub for real-time notifications.
/// Authentication is intentionally NOT required here — clients connect anonymously
/// via WebSocket and self-identify by passing ?departmentId=X or ?role=Admin in the
/// query string. This keeps the frontend simple (no JWT on the WebSocket connection).
/// </summary>
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Read departmentId from the connection query string (sent by the frontend)
        var departmentIdStr = Context.GetHttpContext()?.Request.Query["departmentId"].FirstOrDefault();
        if (int.TryParse(departmentIdStr, out var departmentId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, DepartmentGroupName(departmentId));
        }

        // Read role to join Admins group
        var role = Context.GetHttpContext()?.Request.Query["role"].FirstOrDefault();
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
        }

        // TechLeader joins Leaders group
        if (string.Equals(role, "TechLeader", StringComparison.OrdinalIgnoreCase))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Leaders");
        }

        // Staff joins Staff group and personal group for targeted notifications
        if (string.Equals(role, "Staff", StringComparison.OrdinalIgnoreCase))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "AllStaff");
            var userIdStr = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
            if (int.TryParse(userIdStr, out var staffUserId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, StaffGroupName(staffUserId));
            }
        }

        // Any role with userId joins personal group
        var userIdFromQuery = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
        if (int.TryParse(userIdFromQuery, out var userIdVal))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroupName(userIdVal));
        }

        await base.OnConnectedAsync();
    }

    /// <summary>Client can also call this method after connecting to join a department group.</summary>
    public async Task JoinDepartmentGroup(int departmentId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, DepartmentGroupName(departmentId));
    }

    public static string DepartmentGroupName(int departmentId) => $"Department_{departmentId}";
    public static string StaffGroupName(int staffUserId) => $"Staff_{staffUserId}";
    public static string UserGroupName(int userId) => $"User_{userId}";
}