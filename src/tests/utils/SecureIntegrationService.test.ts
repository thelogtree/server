import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
} from "logtree-types";
import { IntegrationFactory } from "../factories/IntegrationFactory";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import { Integration } from "src/models/Integration";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import faker from "faker";
import { simplifiedLogTagEnum } from "src/services/ApiService/lib/LogService";

describe("AddOrUpdateIntegration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly updates an existing integration with new keys", async () => {
    const projectConnectionsSpy = jest
      .spyOn(SecureIntegrationService, "finishConnection")
      .mockImplementation(() => Promise.resolve(true));
    const integration = await IntegrationFactory.create({
      keys: [
        {
          encryptedValue: "abc",
          type: keyTypeEnum.AuthToken,
        },
      ],
    });

    await SecureIntegrationService.addOrUpdateIntegration(
      integration.organizationId.toString(),
      integrationTypeEnum.Sentry,
      [
        {
          plaintextValue: "aaaaa",
          type: keyTypeEnum.ApiKey,
        },
        {
          plaintextValue: "bbbbb",
          type: keyTypeEnum.SecretKey,
        },
      ]
    );

    const integrationsForOrganization = await Integration.find({
      organizationId: integration.organizationId,
    }).exec();
    expect(integrationsForOrganization.length).toBe(1);

    const updatedIntegration = integrationsForOrganization[0];
    expect(updatedIntegration.type).toBe(integrationTypeEnum.Sentry);
    expect(updatedIntegration.keys.length).toBe(2);
    expect(updatedIntegration.keys[0].type).toBe(keyTypeEnum.ApiKey);
    expect(updatedIntegration.keys[1].type).toBe(keyTypeEnum.SecretKey);
    expect(updatedIntegration.keys[0].encryptedValue).not.toBe(
      integration.keys[0].encryptedValue
    );
    expect(updatedIntegration.keys[0].encryptedValue).toBeTruthy();
    expect(updatedIntegration.keys[1].encryptedValue).toBeTruthy();

    expect(projectConnectionsSpy).toBeCalledTimes(1);
  });
  it("correctly creates a new integration", async () => {
    const projectConnectionsSpy = jest
      .spyOn(SecureIntegrationService, "finishConnection")
      .mockImplementation(() => Promise.resolve(true));
    const decoyIntegration = await IntegrationFactory.create({
      keys: [
        {
          encryptedValue: "abc",
          type: keyTypeEnum.AuthToken,
        },
      ],
    });
    const organization = await OrganizationFactory.create();

    const integrationsForOrganizationBefore = await Integration.find({
      organizationId: organization._id,
    }).exec();
    expect(integrationsForOrganizationBefore.length).toBe(0);

    await SecureIntegrationService.addOrUpdateIntegration(
      organization._id.toString(),
      integrationTypeEnum.Sentry,
      [
        {
          plaintextValue: "aaaaa",
          type: keyTypeEnum.AuthToken,
        },
      ]
    );

    const integrationsForOrganizationAfter = await Integration.find({
      organizationId: organization._id,
    }).exec();
    expect(integrationsForOrganizationAfter.length).toBe(1);

    const createdIntegration = integrationsForOrganizationAfter[0];
    expect(createdIntegration.type).toBe(integrationTypeEnum.Sentry);
    expect(createdIntegration.keys.length).toBe(1);
    expect(createdIntegration.keys[0].type).toBe(keyTypeEnum.AuthToken);
    expect(createdIntegration.keys[0].encryptedValue).not.toBe(
      decoyIntegration.keys[0].encryptedValue
    );
    expect(createdIntegration.keys[0].encryptedValue).toBeTruthy();

    expect(projectConnectionsSpy).toBeCalledTimes(1);
  });
  it("correctly creates a new integration but fails to finish the connection", async () => {
    const projectConnectionsSpy = jest
      .spyOn(SecureIntegrationService, "finishConnection")
      .mockImplementation(() => Promise.resolve(false));
    const decoyIntegration = await IntegrationFactory.create({
      keys: [
        {
          encryptedValue: "abc",
          type: keyTypeEnum.AuthToken,
        },
      ],
    });
    const organization = await OrganizationFactory.create();

    const integrationsForOrganizationBefore = await Integration.find({
      organizationId: organization._id,
    }).exec();
    expect(integrationsForOrganizationBefore.length).toBe(0);

    let errorMsg = "";
    try {
      await SecureIntegrationService.addOrUpdateIntegration(
        organization._id.toString(),
        integrationTypeEnum.Sentry,
        [
          {
            plaintextValue: "aaaaa",
            type: keyTypeEnum.AuthToken,
          },
        ]
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
    expect(errorMsg).toBe(
      "Something went wrong. Please make sure any keys you provided are correct. If you need help, reach out to us at hello@logtree.co"
    );

    const integrationsForOrganizationAfter = await Integration.find({
      organizationId: organization._id,
    }).exec();
    expect(integrationsForOrganizationAfter.length).toBe(0);

    expect(projectConnectionsSpy).toBeCalledTimes(1);
  });
  it("fails to create a new integration for an integration that is not supported anymore.", async () => {
    const organization = await OrganizationFactory.create();

    let errorMsg = "";
    try {
      await SecureIntegrationService.addOrUpdateIntegration(
        organization._id.toString(),
        // @ts-ignore
        "some-random-integration",
        [
          {
            plaintextValue: "aaaaa",
            type: keyTypeEnum.AuthToken,
          },
        ]
      );
    } catch (e: any) {
      errorMsg = e.message;
    }

    const integrationsForOrganizationAfter = await Integration.find({
      organizationId: organization._id,
    }).exec();
    expect(integrationsForOrganizationAfter.length).toBe(0);

    expect(errorMsg).toBe("This integration is not available right now.");
  });
});

describe("GetDecryptedKeysForIntegration (also e2e)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly gets the decrypted keys for an integration", async () => {
    const projectConnectionsSpy = jest
      .spyOn(SecureIntegrationService, "finishConnection")
      .mockImplementation(() => Promise.resolve(true));
    const organization = await OrganizationFactory.create();
    const plaintextValue = faker.datatype.uuid();

    await SecureIntegrationService.addOrUpdateIntegration(
      organization._id.toString(),
      integrationTypeEnum.Sentry,
      [
        {
          plaintextValue: plaintextValue,
          type: keyTypeEnum.AuthToken,
        },
      ]
    );

    const integration = await Integration.findOne({
      organizationId: organization._id,
    }).exec();
    expect(integration!.keys[0].encryptedValue).not.toBe(plaintextValue);
    expect(integration!.keys[0].encryptedValue).toBeTruthy();
    expect(integration!.keys[0].encryptedValue.length).toBeGreaterThan(
      plaintextValue.length
    );

    const decryptedKeys =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration!);
    expect(decryptedKeys.length).toBe(1);
    expect(decryptedKeys[0].type).toBe(keyTypeEnum.AuthToken);
    expect(decryptedKeys[0].plaintextValue).toBe(plaintextValue);

    expect(projectConnectionsSpy).toBeCalledTimes(1);
  });
});

describe("FinishConnection", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it("correctly finishes the connection (no extra work)", async () => {
    const getSetupFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectSetupFunctionToRun")
      .mockImplementation(() => undefined);
    const integration = await IntegrationFactory.create();

    const wasSuccessful = await SecureIntegrationService.finishConnection(
      integration
    );

    const updatedIntegration = await Integration.findById(
      integration._id
    ).exec();
    expect(updatedIntegration).toBeTruthy();

    expect(getSetupFunctionToRunSpy).toBeCalledTimes(1);
    expect(wasSuccessful).toBe(true);
  });
  it("correctly finishes the connection (there was extra work)", async () => {
    const innerFxn = jest.fn((_integration: IntegrationDocument) => {});
    const getSetupFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectSetupFunctionToRun")
      .mockImplementation(() => innerFxn);
    const integration = await IntegrationFactory.create();

    const wasSuccessful = await SecureIntegrationService.finishConnection(
      integration
    );

    const updatedIntegration = await Integration.findById(
      integration._id
    ).exec();
    expect(updatedIntegration).toBeTruthy();

    expect(getSetupFunctionToRunSpy).toBeCalledTimes(1);
    expect(innerFxn).toBeCalledTimes(1);
    expect(innerFxn.mock.calls[0][0]._id.toString()).toBe(integration.id);
    expect(wasSuccessful).toBe(true);
  });
  it("fails to finish the connection", async () => {
    const innerFxn = jest.fn((_integration: IntegrationDocument) => {
      throw new Error("something wrong");
    });
    const getSetupFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectSetupFunctionToRun")
      .mockImplementation(() => innerFxn);
    const integration = await IntegrationFactory.create();

    const wasSuccessful = await SecureIntegrationService.finishConnection(
      integration
    );

    const updatedIntegration = await Integration.findById(
      integration._id
    ).exec();
    expect(updatedIntegration).toBeTruthy();

    expect(getSetupFunctionToRunSpy).toBeCalledTimes(1);
    expect(innerFxn).toBeCalledTimes(1);
    expect(innerFxn.mock.calls[0][0]._id.toString()).toBe(integration.id);
    expect(wasSuccessful).toBe(false);
  });
});

describe("GetLogsFromIntegrations", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it("correctly gets the logs from integrations", async () => {
    const innerFxn = jest.fn(
      (integration: IntegrationDocument, _query: string) =>
        Promise.resolve([
          {
            _id: "abc",
            content: "def",
            createdAt: integration["createdAt"],
            tag: simplifiedLogTagEnum.Error,
          },
        ])
    );
    const getLogsFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectLogsFunctionToRun")
      .mockImplementation(() => innerFxn);

    const organization = await OrganizationFactory.create();
    const integration1 = await IntegrationFactory.create({
      type: integrationTypeEnum.Sentry,
      organizationId: organization._id,
    });
    const integration2 = await IntegrationFactory.create({
      type: integrationTypeEnum.Sentry,
      organizationId: organization._id,
    });
    await IntegrationFactory.create({
      type: integrationTypeEnum.Sentry,
    });

    const logs = await SecureIntegrationService.getLogsFromIntegrations(
      organization._id.toString(),
      "something"
    );

    expect(getLogsFunctionToRunSpy).toBeCalledTimes(2);
    expect(innerFxn).toBeCalledTimes(2);

    expect(logs).toEqual(
      expect.arrayContaining([
        {
          _id: "abc",
          content: "def",
          createdAt: integration1["createdAt"],
          tag: simplifiedLogTagEnum.Error,
        },
        {
          _id: "abc",
          content: "def",
          createdAt: integration2["createdAt"],
          tag: simplifiedLogTagEnum.Error,
        },
      ])
    );
  });
});
