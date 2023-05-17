import axios from "axios";
import {
  IntegrationDocument,
  keyTypeEnum,
  OrganizationDocument,
  simplifiedLogTagEnum,
} from "logtree-types";
import moment from "moment";
import {
  MAX_NUM_CHARS_ALLOWED_IN_LOG,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import { ApiError } from "src/utils/errors";
import { getFloorLogRetentionDateForOrganization } from "src/utils/helpers";

import { SecureIntegrationService } from "../SecureIntegrationService";
import { IntegrationServiceType } from "../types";

const BASE_URL = "https://api.customer.io/v1";

export const CustomerioService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find((key) => key.type === keyTypeEnum.ApiKey);
    if (!key) {
      throw new ApiError("No CustomerIO key exists for this organization.");
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
    const headers = CustomerioService.getHeaders(integration);

    let messagesResult: any[] = [];
    if (query) {
      const messagesRes = await axios.get(
        `${BASE_URL}/customers/${query}/messages`,
        {
          params: {
            id_type: "email",
            limit: 100,
          },
          headers,
        }
      );
      const { messages } = messagesRes.data;
      messagesResult = messages;
    } else {
      const allMessagesRes = await axios.get(`${BASE_URL}/messages`, {
        params: {
          limit: 100,
        },
        headers,
      });
      const { messages } = allMessagesRes.data;
      messagesResult = messages;
    }

    let logs: SimplifiedLog[] = [];
    messagesResult.forEach((message) => {
      const metricKeys = Object.keys(message.metrics);
      metricKeys.forEach((metricKey) => {
        const dateOfLog = new Date(message.metrics[metricKey] * 1000);
        if (
          !["drafted"].includes(metricKey) &&
          moment(dateOfLog).isSameOrAfter(floorDate)
        ) {
          logs.push({
            _id: `customerio_${message.id}_${metricKey}`,
            content: `${message.type} intended to go to ${
              query ||
              (message.type === "email" ? message.recipient : undefined) ||
              "some user"
            } was ${metricKey}.${
              message.subject ? `\n\nEmail subject: ${message.subject}` : ""
            }`.slice(0, MAX_NUM_CHARS_ALLOWED_IN_LOG),
            createdAt: dateOfLog,
            referenceId:
              query ||
              (message.type === "email" ? message.recipient : undefined),
            externalLink: `https://fly.customer.io/journeys/env/${
              (integration.additionalProperties as any).workspaceId
            }/people/${message.customer_identifiers.cio_id}/activity`,
            tag: simplifiedLogTagEnum.Marketing,
            sourceTitle: "Customer.io",
          } as SimplifiedLog);
        }
      });
    });

    return logs;
  },
  getQuestionAnswerLogs: async (integration: IntegrationDocument) => {
    const headers = CustomerioService.getHeaders(integration);
    const allMessagesRes = await axios.get(`${BASE_URL}/messages`, {
      params: {
        limit: 1000,
      },
      headers,
    });
    const { messages } = allMessagesRes.data;

    return messages.map((message) => ({
      message_template_id: message.msg_template_id,
      message_recipient: message.recipient,
      message_subject: message.subject,
      was_delivered:
        message.type === "email"
          ? Boolean(message.metrics.delivered)
          : "not_collected",
      was_sent: Boolean(message.metrics.sent),
      was_opened:
        message.type === "email"
          ? Boolean(message.metrics.opened)
          : "not_collected",
      was_clicked:
        message.type === "email"
          ? Boolean(message.metrics.clicked)
          : "not_collected",
      message_type: message.type,
      message_created_at: new Date(message.created * 1000).toString(),
    }));
  },
};
