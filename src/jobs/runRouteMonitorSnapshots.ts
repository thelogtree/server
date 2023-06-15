import { executeJob } from "src/backfills/lib";
import { RouteMonitor } from "src/models/RouteMonitor";
import { RouteMonitorSnapshot } from "src/models/RouteMonitorSnapshot";

export const runRouteMonitorSnapshotsJob = async () => {
  // get all the route monitors and take a snapshot of them
  const routeMonitors = await RouteMonitor.find().lean();
  await Promise.all(
    routeMonitors.map(async (routeMonitor) => {
      await RouteMonitorSnapshot.create({
        organizationId: routeMonitor.organizationId,
        routeMonitorId: routeMonitor._id,
        path: routeMonitor.path,
        errorCodes: routeMonitor.errorCodes,
        numCalls: routeMonitor.numCalls,
      });
    })
  );
};

executeJob(runRouteMonitorSnapshotsJob);
