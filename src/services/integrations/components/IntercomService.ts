import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  OAuthRequestDocument,
  OrganizationDocument,
  simplifiedLogTagEnum,
} from "logtree-types";
import {
  MAX_NUM_CHARS_ALLOWED_IN_LOG,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import { ApiError, AuthError } from "src/utils/errors";
import { getFloorLogRetentionDateForOrganization } from "src/utils/helpers";

import { SecureIntegrationService } from "../SecureIntegrationService";
import { IntegrationServiceType } from "../types";
import axios from "axios";
import moment from "moment";
import _ from "lodash";
import { config } from "src/utils/config";
import { OAuthRequest } from "src/models/OAuthRequest";
import { LeanDocument } from "mongoose";

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

    await OAuthRequest.updateOne(
      { _id: openOAuthRequest._id },
      { isComplete: true }
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
};
