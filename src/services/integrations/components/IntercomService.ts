import axios from "axios";
import crypto from "crypto";
import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  OAuthRequestDocument,
  OrganizationDocument,
} from "logtree-types";
import { LeanDocument } from "mongoose";
import { Integration } from "src/models/Integration";
import { SimplifiedLog } from "src/services/ApiService/lib/LogService";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";

import { SecureIntegrationService } from "../SecureIntegrationService";
import { IntegrationServiceType } from "../types";
import { Logger } from "src/utils/logger";

const BASE_URL = "https://api.intercom.io";

export const IntercomService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find(
      (key) => key.type === keyTypeEnum.AuthToken
    );
    if (!key) {
      throw new ApiError("No Intercom key exists for this organization.");
    }

    return {
      Authorization: `Bearer ${key.plaintextValue}`,
    };
  },
  getLogs: async (
    organization: OrganizationDocument,
    integration: IntegrationDocument,
    query: string
  ): Promise<SimplifiedLog[]> => {
    return [];
  },
  finishConnection: async (integration: IntegrationDocument) => {
    const headers = IntercomService.getHeaders(integration);
    const meRes = await axios.get(BASE_URL + "/me", { headers });
    const appId = meRes.data.app.id_code;
    await Integration.updateOne(
      { _id: integration._id },
      {
        additionalProperties: {
          appId,
        },
      }
    );
  },
  exchangeOAuthTokenAndConnect: async (
    openOAuthRequest: LeanDocument<OAuthRequestDocument>,
    code: string
  ) => {
    const res = await axios.post(BASE_URL + "/auth/eagle/token", {
      code,
      client_id: config.intercom.appClientId,
      client_secret: config.intercom.appClientSecret,
    });
    const { token } = res.data;

    await SecureIntegrationService.addOrUpdateIntegration(
      openOAuthRequest.organizationId.toString(),
      integrationTypeEnum.Intercom,
      [
        {
          type: keyTypeEnum.AuthToken,
          plaintextValue: token,
        },
      ]
    );
  },
  getIntegrationOAuthLink: (oauthRequest: OAuthRequestDocument) =>
    `https://app.intercom.com/oauth?client_id=${
      config.intercom.appClientId
    }&state=${oauthRequest._id.toString()}`,
  removeOAuthConnection: async (integration: IntegrationDocument) => {
    const headers = IntercomService.getHeaders(integration);
    await axios.post(BASE_URL + "/auth/uninstall", undefined, { headers });
  },
  removedOAuthConnectionElsewhereAndNeedToUpdateOurOwnRecords: async (
    details: any
  ) => {
    await Integration.deleteOne({
      "additionalProperties.appId": details.app_id,
    });
  },
  verifyWebhookCameFromTrustedSource: (headers: any, body: any) => {
    Logger.sendLog(JSON.stringify(headers), "/debugging");
    const requestHmac = headers["X-Hub-Signature"].slice(5);

    const replacer = (key: string, value: any) =>
      value instanceof Object && !(value instanceof Array)
        ? Object.keys(value)
            .sort()
            .reduce((sorted, key) => {
              sorted[key] = value[key];
              return sorted;
            }, {})
        : value;

    const requestJson = JSON.stringify(body, replacer);
    const dataHmac = crypto
      .createHmac("sha1", config.intercom.appClientSecret as any)
      .update(requestJson)
      .digest("base64");

    return crypto.timingSafeEqual(
      Buffer.from(requestHmac),
      Buffer.from(dataHmac)
    );
  },
};
