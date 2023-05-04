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

export type PlaintextKey = {
  type: keyTypeEnum;
  plaintextValue: string;
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

    if (existingIntegration) {
      return Integration.findByIdAndUpdate(
        existingIntegration._id,
        {
          keys: encryptedKeys,
        },
        { new: true }
      )
        .lean()
        .exec();
    } else {
      return Integration.create({
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
