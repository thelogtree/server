import CryptoJS from "crypto-js";
import {
  IntegrationDocument,
  Key,
  OrganizationDocument,
  integrationTypeEnum,
  keyTypeEnum,
} from "logtree-types";
import { LeanDocument } from "mongoose";
import { Integration } from "src/models/Integration";
import { config } from "src/utils/config";
import { ApiError, AuthError } from "src/utils/errors";
import {
  ExchangeOAuthTokenAndConnectFxnType,
  FinishSetupFxnType,
  GetIntegrationLogsFxnType,
} from "./types";
import {
  IntegrationExchangeOAuthTokenAndConnectMap,
  IntegrationFinishSetupFunctionsToRunMap,
  IntegrationGetLogsMap,
  IntegrationGetOAuthLinkMap,
  IntegrationRemoveOAuthMap,
  integrationsAvailableToConnectTo,
} from "./lib";
import _ from "lodash";
import { SimplifiedLog } from "../ApiService/lib/LogService";
import { getErrorMessage } from "src/utils/helpers";
import { OAuthRequest } from "src/models/OAuthRequest";

export type PlaintextKey = {
  type: keyTypeEnum;
  plaintextValue: string;
};

export const SecureIntegrationService = {
  addOrUpdateIntegration: async (
    organizationId: string,
    integrationType: integrationTypeEnum,
    keys: PlaintextKey[],
    additionalProperties: Object = {}
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
          additionalProperties,
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
        additionalProperties,
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
  ): FinishSetupFxnType =>
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
    organization: OrganizationDocument,
    query: string
  ): Promise<SimplifiedLog[]> => {
    const integrations = await Integration.find({
      organizationId: organization._id,
    })
      .lean()
      .exec();

    const logResults = await Promise.all(
      integrations.map(async (integration) => {
        try {
          const getLogsFxnToRun =
            SecureIntegrationService.getCorrectLogsFunctionToRun(integration);
          if (getLogsFxnToRun) {
            const results = await getLogsFxnToRun(
              organization,
              integration,
              query
            );
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
  getCorrectOAuthFunctionToRun: (
    integrationType: integrationTypeEnum
  ): ExchangeOAuthTokenAndConnectFxnType | undefined =>
    IntegrationExchangeOAuthTokenAndConnectMap[integrationType],
  exchangeOAuthTokenAndConnect: async (
    organizationId: string,
    sessionId: string,
    code: string
  ) => {
    const openOAuthRequest = await OAuthRequest.findOne({
      _id: sessionId,
      isComplete: false,
      organizationId,
    })
      .lean()
      .exec();
    if (!openOAuthRequest) {
      throw new AuthError(
        "Could not find a pending OAuth request with this session ID."
      );
    }

    const oauthFxn = SecureIntegrationService.getCorrectOAuthFunctionToRun(
      openOAuthRequest.source
    );
    if (oauthFxn) {
      await oauthFxn(openOAuthRequest, code);
    }
  },
  getOAuthLink: async (
    organizationId: string,
    integrationType: integrationTypeEnum
  ) => {
    let getOAuthLinkFxn = IntegrationGetOAuthLinkMap[integrationType];

    if (!getOAuthLinkFxn) {
      throw new ApiError("OAuth is not an option for this integration.");
    }

    const oauthRequest = await OAuthRequest.create({
      organizationId,
      source: integrationType,
    });
    return getOAuthLinkFxn(oauthRequest);
  },
  removeAnyOAuthConnectionIfApplicable: async (integration: IntegrationDocument) => {
    let removeOAuthFxn = IntegrationRemoveOAuthMap[integration.type];
    if (removeOAuthFxn) {
      // was an oauth connection, need to delete it via the integration's API if possible
      await removeOAuthFxn(integration);
    }
  },
};
