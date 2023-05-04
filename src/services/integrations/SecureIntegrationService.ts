import CryptoJS from "crypto-js";
import {
  IntegrationDocument,
  Key,
  integrationTypeEnum,
  keyTypeEnum,
} from "logtree-types";
import { LeanDocument } from "mongoose";
import { Integration } from "src/models/Integration";
import { config } from "src/utils/config";
import { SentryService } from "./components/SentryService";
import { ApiError } from "src/utils/errors";

export type PlaintextKey = {
  type: keyTypeEnum;
  plaintextValue: string;
};

const _finishSetupFunctionsToRun: {
  [key in integrationTypeEnum]: (organizationId: string) => any;
} = {
  sentry: SentryService.refreshProjectConnections,
};

export const SecureIntegrationService = {
  addOrUpdateIntegration: async (
    organizationId: string,
    integrationType: integrationTypeEnum,
    keys: PlaintextKey[]
  ): Promise<LeanDocument<IntegrationDocument> | IntegrationDocument> => {
    const encryptedKeys: Key[] = keys.map((key) => {
      const encryptedValue = CryptoJS.AES.encrypt(
        key.plaintextValue,
        config.encryption.encryptDecryptKey
      ).toString();
      return {
        type: key.type,
        encryptedValue,
      };
    });

    const existingIntegration = await Integration.findOne({
      organizationId,
      type: integrationType,
    }).exec();

    let integration;
    if (existingIntegration) {
      integration = await Integration.findByIdAndUpdate(
        existingIntegration._id,
        {
          keys: encryptedKeys,
        },
        { new: true }
      )
        .lean()
        .exec();
    } else {
      integration = await Integration.create({
        organizationId,
        type: integrationType,
        keys: encryptedKeys,
      });
    }

    const wasSuccessful = await SecureIntegrationService.finishConnection(
      integration!
    );

    if (!wasSuccessful) {
      await Integration.deleteOne({ _id: integration._id });
      throw new ApiError(
        "Something went wrong. Please make sure any keys you provided are correct. If you need help, reach out to us at hello@logtree.co"
      );
    }

    return integration;
  },
  getDecryptedKeysForIntegration: (
    integration: IntegrationDocument
  ): PlaintextKey[] => {
    const decryptedKeys = integration.keys.map((key) => {
      const bytes = CryptoJS.AES.decrypt(
        key.encryptedValue,
        config.encryption.encryptDecryptKey
      );
      const plaintextValue = bytes.toString(CryptoJS.enc.Utf8);
      return {
        type: key.type,
        plaintextValue,
      };
    });

    return decryptedKeys;
  },
  finishConnection: async (integration: IntegrationDocument) => {
    // todo: add unit test(s) for this fxn

    let wasSuccessful = false;
    try {
      const finishSetupFxn = _finishSetupFunctionsToRun[integration.type];
      if (finishSetupFxn) {
        await finishSetupFxn(integration.organizationId.toString());
      }
      await Integration.updateOne(
        { _id: integration._id },
        { hasFinishedSetup: true }
      );
      wasSuccessful = true;
    } catch (e) {}
    return wasSuccessful;
  },
};
