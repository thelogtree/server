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
import { ApiError } from "src/utils/errors";
import { FinishSetupFunctionType, GetIntegrationLogsFxnType } from "./types";
import {
  IntegrationFinishSetupFunctionsToRunMap,
  IntegrationGetLogsMap,
  integrationsAvailableToConnectTo,
} from "./lib";
import _ from "lodash";
import { SimplifiedLog } from "../ApiService/lib/LogService";
import { getErrorMessage } from "src/utils/helpers";

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
    if (!integrationsAvailableToConnectTo.includes(integrationType)) {
      throw new ApiError("This integration is not available right now.");
    }

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
  // main reason this is extracted is so we can mock it in a unit test easily
  getCorrectSetupFunctionToRun: (
    integration: IntegrationDocument
  ): FinishSetupFunctionType =>
    IntegrationFinishSetupFunctionsToRunMap[integration.type],
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
    let wasSuccessful = false;
    try {
      const finishSetupFxn =
        SecureIntegrationService.getCorrectSetupFunctionToRun(integration);
      if (finishSetupFxn) {
        await finishSetupFxn(integration);
      }
      wasSuccessful = true;
    } catch (e) {}
    return wasSuccessful;
  },
  getCorrectLogsFunctionToRun: (
    integration: IntegrationDocument
  ): GetIntegrationLogsFxnType | undefined =>
    IntegrationGetLogsMap[integration.type],
  getLogsFromIntegrations: async (
    organizationId: string,
    query: string
  ): Promise<SimplifiedLog[]> => {
    const integrations = await Integration.find({ organizationId })
      .lean()
      .exec();

    const logResults = await Promise.all(
      integrations.map(async (integration) => {
        try {
          const getLogsFxnToRun =
            SecureIntegrationService.getCorrectLogsFunctionToRun(integration);
          if (getLogsFxnToRun) {
            const results = await getLogsFxnToRun(integration, query);
            return results;
          }
          return [];
        } catch (e: any) {
          console.log(getErrorMessage(e));
          return [];
        }
      })
    );

    const flattenedResults = _.flatten(logResults);

    return flattenedResults;
  },
  getConnectableIntegrationsForOrganization: async (organizationId: string) => {
    const connectedIntegrationTypes = await Integration.find(
      { organizationId },
      { type: 1 }
    ).exec();

    // prune the integrations this organization has already connected to
    return integrationsAvailableToConnectTo.filter(
      (type) =>
        !connectedIntegrationTypes.find((typeObj) => typeObj.type === type)
    );
  },
};
