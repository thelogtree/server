import {
  IntegrationDocument,
  OrganizationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  simplifiedLogTagEnum,
} from "logtree-types";
import { Integration } from "src/models/Integration";
import { ApiError } from "src/utils/errors";
import { SecureIntegrationService } from "../SecureIntegrationService";
import axios from "axios";
import {
  MAX_NUM_CHARS_ALLOWED_IN_LOG,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import _ from "lodash";
import { IntegrationServiceType } from "../types";
import { getFloorLogRetentionDateForOrganization } from "src/utils/helpers";
import moment from "moment";

const BASE_URL = "https://api.sendgrid.com/v3";

export const SendgridService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find((key) => key.type === keyTypeEnum.ApiKey);
    if (!key) {
      throw new ApiError("No Sendgrid key exists for this organization.");
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
    const headers = SendgridService.getHeaders(integration);

    const allMessagesRes = await axios.get(BASE_URL + "/messages", {
      params: {
        query: `query=to_email="${query}"`,
      },
      headers,
    });
    const { messages } = allMessagesRes.data;

    let messageEvents: SimplifiedLog[] = [];
    await Promise.all(
      messages.map(async (message) => {
        const messageEventsRes = await axios.get(
          BASE_URL + "/messages/" + message.msg_id,
          {
            headers,
          }
        );
        const { events } = messageEventsRes.data;

        events.forEach((event, i) => {
          if (moment(event.processed).isSameOrAfter(floorDate)) {
            messageEvents.push({
              _id: `sendgrid_${message.msg_id}_${i}`,
              content: `Email to ${query} was ${event.event_name} because ${event.reason}.\n\nEmail subject: ${event.subject}`,
              createdAt: new Date(event.processed),
              tag: simplifiedLogTagEnum.Marketing,
              sourceTitle: "Sendgrid",
            });
          }
        });
      })
    );

    return messageEvents;
  },
};
