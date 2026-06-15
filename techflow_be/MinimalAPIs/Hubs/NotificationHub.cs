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

        await base.OnConnectedAsync();
    }

    /// <summary>Client can also call this method after connecting to join a department group.</summary>
    public async Task JoinDepartmentGroup(int departmentId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, DepartmentGroupName(departmentId));
    }

    public static string DepartmentGroupName(int departmentId) => $"Department_{departmentId}";
}