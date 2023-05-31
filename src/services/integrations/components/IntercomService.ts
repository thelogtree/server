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
import moment from "moment";
import { LeanDocument } from "mongoose";
import { Integration } from "src/models/Integration";
import {
  MAX_NUM_CHARS_ALLOWED_IN_LOG,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import { IntegrationServiceType } from "src/services/integrations/types";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";
import { getFloorLogRetentionDateForOrganization } from "src/utils/helpers";
import { MyLogtree } from "src/utils/logger";
import { SecureIntegrationService } from "src/services/integrations/index";

const BASE_URL = "https://api.intercom.io";

type ExtraIntercomServiceTypes = {
  sendNote: (
    integration: IntegrationDocument,
    conversationId: string,
    adminId: string,
    body: string,
    linkToLogtreeJourney: string
  ) => Promise<any>;
  getAdminIds: (integration: IntegrationDocument) => Promise<any>;
  getLogsForSupportBot: (
    integration: IntegrationDocument
  ) => Promise<SimplifiedLog[]>;
};

export const IntercomService: IntegrationServiceType &
  ExtraIntercomServiceTypes = {
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
    query?: string
  ): Promise<SimplifiedLog[]> => {
    const floorDate = getFloorLogRetentionDateForOrganization(organization);
    const headers = IntercomService.getHeaders(integration);

    let conversationsResult: any[] = [];
    if (query) {
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
      conversationsResult = conversations;
    } else {
      const res = await axios.get(BASE_URL + "/conversations", { headers });
      const { conversations } = res.data;
      conversationsResult = conversations;
    }

    let allConversationParts: any[] = [];
    await Promise.all(
      conversationsResult.map(async (conversation) => {
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

    return allConversationParts
      .map((conversationPart: any) => ({
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
        referenceId: conversationPart.author?.email,
      }))
      .concat(
        conversationsResult.map((conversation) => ({
          _id: `intercom_${conversation.id}_init`,
          content: `From ${
            conversation.source.author.name || "user"
          }:\n\n${conversation.source.body?.slice(
            0,
            MAX_NUM_CHARS_ALLOWED_IN_LOG
          )}`,
          createdAt: new Date(conversation.created_at * 1000),
          externalLink: `https://app.intercom.com/a/inbox/${
            (integration.additionalProperties as any).appId as string
          }/inbox/shared/all/conversation/${conversation.id}`,
          tag: simplifiedLogTagEnum.Support,
          sourceTitle: "Intercom",
          referenceId: conversation.source.author?.email,
        }))
      );
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
  sendNote: async (
    integration: IntegrationDocument,
    conversationId: string,
    adminId: string,
    body: string,
    linkToLogtreeJourney: string
  ) => {
    const headers = IntercomService.getHeaders(integration);
    await axios.post(
      BASE_URL + `/conversations/${conversationId}/reply`,
      {
        message_type: "note", // do not change this!!!
        type: "admin",
        admin_id: adminId,
        body: `(Logtree Bot)\n${body}\n\nView details: ${linkToLogtreeJourney}`,
      },
      { headers }
    );
    void MyLogtree.sendLog({
      content: `Successfully sent Intercom note for: "${body.slice(0, 80)}..."`,
      folderPath: "/support-bot-responses-sent",
      additionalContext: {
        integrationId: integration._id,
        organizationId: integration.organizationId,
        adminId,
        linkToLogtreeJourney,
      },
    });
  },
  getAdminIds: async (integration: IntegrationDocument) => {
    const headers = IntercomService.getHeaders(integration);
    const res = await axios.get(BASE_URL + "/admins", { headers });
    const { admins } = res.data;
    return admins.map((admin) => admin.id);
  },
  getLogsForSupportBot: async (
    integration: IntegrationDocument
  ): Promise<SimplifiedLog[]> => {
    const floorDate = moment().subtract(5, "minutes"); // keep this the cron interval so you don't respond to a message multiple times
    const headers = IntercomService.getHeaders(integration);

    let conversationsResult: any[] = [];
    const res = await axios.get(BASE_URL + "/conversations", { headers });
    const { conversations } = res.data;
    conversationsResult = conversations;

    let allConversationParts: any[] = [];
    await Promise.all(
      conversationsResult.map(async (conversation) => {
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
            moment(new Date(part.created_at * 1000)).isSameOrAfter(floorDate) &&
            part.author.type !== "admin"
          ) {
            allConversationParts.push({
              ...part,
              conversationId: conversation.id,
            });
          }
        });
      })
    );

    const allMessagesUnsorted = allConversationParts
      .map((conversationPart: any) => ({
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
        referenceId: conversationPart.author?.email,
      }))
      .concat(
        conversationsResult.map((conversation) => ({
          _id: `intercom_${conversation.id}_init`,
          content: `From ${
            conversation.source.author.name || "user"
          }:\n\n${conversation.source.body?.slice(
            0,
            MAX_NUM_CHARS_ALLOWED_IN_LOG
          )}`,
          createdAt: new Date(conversation.created_at * 1000),
          externalLink: `https://app.intercom.com/a/inbox/${
            (integration.additionalProperties as any).appId as string
          }/inbox/shared/all/conversation/${conversation.id}`,
          tag: simplifiedLogTagEnum.Support,
          sourceTitle: "Intercom",
          referenceId: conversation.source.author?.email,
        }))
      );

    const allMessagesSorted = allMessagesUnsorted.sort((a, b) =>
      moment(a["createdAt"]).isAfter(moment(b["createdAt"])) ? -1 : 1
    );

    return allMessagesSorted.filter((message) =>
      moment(message.createdAt).isAfter(floorDate)
    );
  },
};
