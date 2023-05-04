import { integrationTypeEnum, keyTypeEnum } from "logtree-types";
import { IntegrationFactory } from "../factories/IntegrationFactory";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import { Integration } from "src/models/Integration";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import faker from "faker";

describe("AddOrUpdateIntegration", () => {
  it("correctly updates an existing integration with new keys", async () => {
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
  });
  it("correctly creates a new integration", async () => {
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
  });
});

describe("GetDecryptedKeysForIntegration (also e2e)", () => {
  it("correctly gets the decrypted keys for an integration", async () => {
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
  });
});
