import { IntegrationFactory } from "src/tests/factories/IntegrationFactory";
import faker from "faker";
import { TestHelper } from "src/tests/TestHelper";
import { Integration } from "src/models/Integration";

const routeUrl = "/webhooks";

describe("IntercomWebhook", () => {
  it("correctly removes the intercom connection in our database after it was removed elsewhere", async () => {
    const appId = faker.datatype.uuid();
    const integration = await IntegrationFactory.create({
      additionalProperties: {
        appId,
      },
    });
    const integrationDecoy = await IntegrationFactory.create({
      additionalProperties: {
        appId: "hello",
      },
    });
    const res = await TestHelper.sendRequest(
      routeUrl + "/intercom",
      "POST",
      {
        app_id: appId,
      },
      {}
    );
    TestHelper.expectSuccess(res);

    const integrationNow = await Integration.findById(integration._id);
    expect(integrationNow).toBeNull();

    const integrationDecoyNow = await Integration.findById(
      integrationDecoy._id
    );
    expect(integrationDecoyNow).toBeTruthy();
  });
  it("correctly does nothing since the intercom connection was already removed", async () => {
    const appId = faker.datatype.uuid();

    const res = await TestHelper.sendRequest(
      routeUrl + "/intercom",
      "POST",
      {
        app_id: appId,
      },
      {}
    );
    TestHelper.expectSuccess(res);
  });
  it("correctly does nothing since we did not detect that it was an oauth removal webhook notification", async () => {
    const appId = faker.datatype.uuid();
    const integration = await IntegrationFactory.create({
      additionalProperties: {
        appId,
      },
    });

    const res = await TestHelper.sendRequest(
      routeUrl + "/intercom",
      "POST",
      {},
      {}
    );
    TestHelper.expectSuccess(res);

    const integrationNow = await Integration.findById(integration._id);
    expect(integrationNow).toBeTruthy();
  });
});
