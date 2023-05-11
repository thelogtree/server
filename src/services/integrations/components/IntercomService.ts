import axios from "axios";
import crypto from "crypto";
import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  OAuthRequestDocument,
  OrganizationDocument,
  simplifiedLogTagEnum,
} from "logtree-types";
import { LeanDocument } from "mongoose";
import { Integration } from "src/models/Integration";
import {
  MAX_NUM_CHARS_ALLOWED_IN_LOG,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";

import { SecureIntegrationService } from "../SecureIntegrationService";
import { IntegrationServiceType } from "../types";
import { getFloorLogRetentionDateForOrganization } from "src/utils/helpers";
import _ from "lodash";
import moment from "moment";

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
    const floorDate = getFloorLogRetentionDateForOrganization(organization);
    const headers = IntercomService.getHeaders(integration);

    const res = await axios.post(
      BASE_URL + "/conversations/search",
      {
        query: {
          field: "source.author.email",
          operator: "=",
          value: query,
        },
      },
      { headers }
    );
    const { conversations } = res.data;

    let allConversationParts: any[] = [];
    await Promise.all(
      conversations.map(async (conversation) => {
        const res = await axios.get(
          BASE_URL + "/conversations/" + conversation.id,
          {
            params: {
              display_as: "plaintext",
            },
            headers,
          }
        );
        const { conversation_parts } = res.data.conversation_parts;
        conversation_parts.forEach((part) => {
          if (
            ["comment", "open"].includes(part.part_type) &&
            moment(new Date(part.created_at * 1000)).isSameOrAfter(floorDate)
          ) {
            allConversationParts.push({
              ...part,
              conversationId: conversation.id,
            });
          }
        });
      })
    );

    return allConversationParts.map((conversationPart: any) => ({
      _id: `intercom_${conversationPart.conversationId}_${conversationPart.id}`,
      content: `From ${
        conversationPart.author.name || "user"
      }:\n\n${conversationPart.body?.slice(0, MAX_NUM_CHARS_ALLOWED_IN_LOG)}`,
      createdAt: new Date(conversationPart.created_at * 1000),
      externalLink: `https://app.intercom.com/a/inbox/${
        (integration.additionalProperties as any).appId as string
      }/inbox/shared/all/conversation/${conversationPart.conversationId}`,
      tag: simplifiedLogTagEnum.Support,
      sourceTitle: "Intercom",
    }));
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
    const hasHubSignature = !!headers["x-hub-signature"];
    const requestHmac =
      (headers["x-hub-signature"] as string | undefined)?.slice(5) ||
      (headers["x-body-signature"] as string | undefined);

    if (!requestHmac) {
      return false;
    }
    const dataHmac = crypto
      .createHmac(
        hasHubSignature ? "sha1" : "sha256",
        config.intercom.appClientSecret as any
      )
      .update(JSON.stringify(body))
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(requestHmac),
      Buffer.from(dataHmac)
    );
  },
};
