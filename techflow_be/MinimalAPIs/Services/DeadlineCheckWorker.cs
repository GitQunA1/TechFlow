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
                    .Where(x => x.Status == DistributionStatus.Pending && x.DeadlineTime.HasValue && x.DeadlineTime < DateTime.UtcNow)
                    .ToListAsync(stoppingToken);

                if (overdueDistributions.Count > 0)
                {
                    foreach (var distribution in overdueDistributions)
                    {
                        distribution.Status = DistributionStatus.Overdue;
                    }

                    await dbContext.SaveChangesAsync(stoppingToken);

                    await broadcaster.BroadcastToAdminsAsync("DeadlineOverdue", new
                    {
                        Count = overdueDistributions.Count,
                        DistributionIds = overdueDistributions.Select(x => x.Id).ToArray()
                    });
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