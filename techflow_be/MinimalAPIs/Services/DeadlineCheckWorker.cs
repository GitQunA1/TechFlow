using MinimalAPIs.Data;
using MinimalAPIs.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace MinimalAPIs.Services;

public sealed class DeadlineCheckWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DeadlineCheckWorker> _logger;

    public DeadlineCheckWorker(IServiceScopeFactory scopeFactory, ILogger<DeadlineCheckWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var broadcaster = scope.ServiceProvider.GetRequiredService<NotificationBroadcaster>();

                var overdueDistributions = await dbContext.Distributions
                    .Include(x => x.Department)
                    .Include(x => x.FileVersion)
                        .ThenInclude(fv => fv.File)
                    .Where(x => x.Status == DistributionStatus.Pending && x.DeadlineTime.HasValue && x.DeadlineTime < DateTime.UtcNow)
                    .ToListAsync(stoppingToken);

                if (overdueDistributions.Count > 0)
                {
                    var folderIds = overdueDistributions.Select(d => d.FileVersion.File.FolderId).Distinct().ToList();

                    // Get the max CreatedAt for each folder to identify the "NEW" files
                    var maxCreatedAtPerFolder = await dbContext.FileVersions
                        .Where(fv => folderIds.Contains(fv.File.FolderId))
                        .GroupBy(fv => fv.File.FolderId)
                        .Select(g => new { FolderId = g.Key, MaxCreatedAt = g.Max(fv => fv.CreatedAt) })
                        .ToDictionaryAsync(x => x.FolderId, x => x.MaxCreatedAt, stoppingToken);

                    var genuinelyOverdue = new List<MinimalAPIs.Domain.Entities.Distribution>();

                    foreach (var d in overdueDistributions)
                    {
                        if (d.FileVersion.CreatedAt == maxCreatedAtPerFolder[d.FileVersion.File.FolderId])
                        {
                            genuinelyOverdue.Add(d);
                        }
                        else
                        {
                            // It's no longer the newest file, so clear its deadline to stop evaluating it
                            d.DeadlineTime = null;
                        }
                    }

                    if (genuinelyOverdue.Count > 0)
                    {
                        var newNotifications = new List<MinimalAPIs.Domain.Entities.Notification>();

                        foreach (var distribution in genuinelyOverdue)
                        {
                            distribution.Status = DistributionStatus.Overdue;

                        // Create a notification for the Production department
                        newNotifications.Add(new MinimalAPIs.Domain.Entities.Notification
                        {
                            DepartmentId = distribution.DepartmentId,
                            Title = "Overdue Warning",
                            Message = $"File {distribution.FileVersion.File.FileName} v{distribution.FileVersion.VersionNumber} is overdue for confirmation! Please check it immediately.",
                            TargetFolderId = distribution.FileVersion.File.FolderId,
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    dbContext.Notifications.AddRange(newNotifications);

                    // Notify Admins
                    await broadcaster.BroadcastToAdminsAsync("DeadlineOverdue", new
                    {
                        Count = genuinelyOverdue.Count,
                        DistributionIds = genuinelyOverdue.Select(x => x.Id).ToArray()
                    });

                    // Notify each department that they have overdue files
                    var deptIds = genuinelyOverdue.Select(d => d.DepartmentId).Distinct().ToList();
                    await broadcaster.BroadcastToDepartmentsAsync(deptIds, "DeadlineOverdue", new { Message = "You have overdue files!" });
                }
                
                // Save any DeadlineTime = null changes for older files as well as Status = Overdue for new ones
                if (overdueDistributions.Count > 0)
                {
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Deadline check worker failed.");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}