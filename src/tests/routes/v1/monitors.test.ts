import { RouteMonitor } from "src/models/RouteMonitor";
import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";

import { TestHelper } from "../../TestHelper";
import { accessValueInMap } from "src/utils/helpers";
import { RouteMonitorFactory } from "src/tests/factories/RouteMonitorFactory";

const routeUrl = "/v1/monitors";

describe("RecordCall", () => {
  it("correctly records a call for the first time", async () => {
    const path = "/some/route";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/track",
      "POST",
      { path },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const routeMonitors = await RouteMonitor.find({
      organizationId: organization._id,
    });
    expect(routeMonitors.length).toBe(1);

    const routeMonitor = routeMonitors[0];
    expect(routeMonitor.path).toBe(path);
    expect(routeMonitor.numCalls).toBe(1);
    expect(routeMonitor.errorCodes).toBeFalsy();
  });
  it("correctly records an error before a call and doesn't explode", async () => {
    const path = "/some/route";
    const errorCode = "403";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/track",
      "POST",
      { path, errorCode },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const routeMonitors = await RouteMonitor.find({
      organizationId: organization._id,
    });
    expect(routeMonitors.length).toBe(1);

    const routeMonitor = routeMonitors[0];
    expect(routeMonitor.path).toBe(path);
    expect(routeMonitor.numCalls).toBe(1);
    expect(accessValueInMap(routeMonitor.errorCodes, "403")).toBe(1);
  });
  it("correctly adds to an error count and numCalls count", async () => {
    const path = "/some/route";
    const errorCode = "403";
    const errorCodeMap = new Map();
    errorCodeMap.set("403", 3);
    errorCodeMap.set("500", 1);
    const organization = await OrganizationFactory.create();
    await RouteMonitorFactory.create({
      organizationId: organization._id,
      path,
      errorCodes: errorCodeMap,
      numCalls: 4,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + "/track",
      "POST",
      { path, errorCode },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const routeMonitors = await RouteMonitor.find({
      organizationId: organization._id,
    });
    expect(routeMonitors.length).toBe(1);

    const routeMonitor = routeMonitors[0];
    expect(routeMonitor.path).toBe(path);
    expect(routeMonitor.numCalls).toBe(4);
    expect(accessValueInMap(routeMonitor.errorCodes, "403")).toBe(4);
    expect(accessValueInMap(routeMonitor.errorCodes, "500")).toBe(1);
  });
  it("correctly adds to an error count and numCalls count (multiple route monitors)", async () => {
    const path = "/some/route";
    const newPath = "/some/route-new";
    const errorCode = "403";
    const errorCodeMap = new Map();
    errorCodeMap.set("403", 3);
    errorCodeMap.set("500", 1);
    const organization = await OrganizationFactory.create();
    await RouteMonitorFactory.create({
      organizationId: organization._id,
      path,
      errorCodes: errorCodeMap,
      numCalls: 4,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + "/track",
      "POST",
      { path: newPath, errorCode },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const routeMonitors = await RouteMonitor.find({
      organizationId: organization._id,
    }).sort({ createdAt: -1 });
    expect(routeMonitors.length).toBe(2);

    const routeMonitor = routeMonitors[0];
    expect(routeMonitor.path).toBe(newPath);
    expect(routeMonitor.numCalls).toBe(1);
    expect(accessValueInMap(routeMonitor.errorCodes, "403")).toBe(1);
    expect(accessValueInMap(routeMonitor.errorCodes, "500")).toBeUndefined();
  });
});
