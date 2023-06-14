import { RouteMonitor } from "src/models/RouteMonitor";
import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";

import { TestHelper } from "../../TestHelper";

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
});
