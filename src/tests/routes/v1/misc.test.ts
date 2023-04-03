import { TestHelper } from "src/tests/TestHelper";
import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";

const routeUrl = "/v1/misc";

describe("TestZapierConnection", () => {
  it("correctly returns a success response", async () => {
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/zapier-test",
      "GET",
      {},
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);
  });
});
