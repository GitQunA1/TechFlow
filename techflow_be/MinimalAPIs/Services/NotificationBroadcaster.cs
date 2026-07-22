using MinimalAPIs.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace MinimalAPIs.Services;

public sealed class NotificationBroadcaster
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public NotificationBroadcaster(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task BroadcastToDepartmentsAsync(IEnumerable<int> departmentIds, string eventName, object payload)
    {
        var tasks = departmentIds
            .Distinct()
            .Select(departmentId => _hubContext.Clients.Group(NotificationHub.DepartmentGroupName(departmentId)).SendAsync(eventName, payload));

        return Task.WhenAll(tasks);
    }

    public Task BroadcastToAdminsAsync(string eventName, object payload)
    {
        return _hubContext.Clients.Group("Admins").SendAsync(eventName, payload);
    }

    public Task BroadcastToLeadersAsync(string eventName, object payload)
    {
        return _hubContext.Clients.Group("Leaders").SendAsync(eventName, payload);
    }

    public Task BroadcastToAllStaffAsync(string eventName, object payload)
    {
        return _hubContext.Clients.Group("AllStaff").SendAsync(eventName, payload);
    }

    public Task BroadcastToStaffAsync(int staffUserId, string eventName, object payload)
    {
        return _hubContext.Clients.Group(NotificationHub.StaffGroupName(staffUserId)).SendAsync(eventName, payload);
    }

    public Task BroadcastToUserAsync(int userId, string eventName, object payload)
    {
        return _hubContext.Clients.Group(NotificationHub.UserGroupName(userId)).SendAsync(eventName, payload);
    }

    public Task BroadcastToAllAsync(string eventName, object payload)
    {
        return _hubContext.Clients.All.SendAsync(eventName, payload);
    }
}