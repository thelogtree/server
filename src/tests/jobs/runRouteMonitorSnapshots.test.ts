import { RouteMonitor } from "src/models/RouteMonitor";
import { RouteMonitorSnapshot } from "src/models/RouteMonitorSnapshot";
import { RouteMonitorFactory } from "../factories/RouteMonitorFactory";
import { runRouteMonitorSnapshotsJob } from "src/jobs/runRouteMonitorSnapshots";
import { RouteMonitorSnapshotDocument } from "logtree-types";
import { accessValueInMap } from "src/utils/helpers";

describe("RunRouteMonitorSnapshots", () => {
  beforeEach(async () => {
    await RouteMonitorSnapshot.deleteMany();
    await RouteMonitor.deleteMany();
  });
  it("correctly runs the route monitor snapshots", async () => {
    const routeMonitor1 = await RouteMonitorFactory.create({
      numCalls: 2,
      errorCodes: { "403": 3 },
    });
    const routeMonitor2 = await RouteMonitorFactory.create({
      numCalls: 5,
    });
    const routeMonitor3 = await RouteMonitorFactory.create();

    await runRouteMonitorSnapshotsJob();

    const allRouteMonitorSnapshots: RouteMonitorSnapshotDocument[] =
      await RouteMonitorSnapshot.find();
    expect(allRouteMonitorSnapshots.length).toBe(3);

    for (const snapshot of allRouteMonitorSnapshots) {
      if (snapshot.routeMonitorId.toString() === routeMonitor1.id) {
        expect(snapshot.numCalls).toBe(2);
        expect(accessValueInMap(snapshot.errorCodes, "403")).toBe(3);
      } else if (snapshot.routeMonitorId.toString() === routeMonitor2.id) {
        expect(snapshot.numCalls).toBe(5);
        expect(accessValueInMap(snapshot.errorCodes, "403")).toBeUndefined();
      } else {
        expect(snapshot.numCalls).toBe(routeMonitor3.numCalls);
        expect(accessValueInMap(snapshot.errorCodes, "403")).toBeUndefined();
      }
    }
  });
});
