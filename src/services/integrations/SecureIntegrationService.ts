import CryptoJS from "crypto-js";
import {
  IntegrationDocument,
  Key,
  integrationTypeEnum,
  keyTypeEnum,
} from "logtree-types";
import { Integration } from "src/models/Integration";
import { config } from "src/utils/config";

export type PlaintextKey = {
  type: keyTypeEnum;
  plaintextValue: string;
};

export const SecureIntegrationService = {
  addOrUpdateIntegration: async (
    organizationId: string,
    integrationType: integrationTypeEnum,
    keys: PlaintextKey[]
  ) => {
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

    if (existingIntegration) {
      await Integration.updateOne(
        { _id: existingIntegration._id },
        { keys: encryptedKeys }
      );
    } else {
      await Integration.create({
        organizationId,
        type: integrationType,
        keys: encryptedKeys,
      });
    }
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
};
