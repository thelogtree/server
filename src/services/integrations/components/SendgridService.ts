import axios from "axios";
import {
  IntegrationDocument,
  integrationTypeEnum,
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
    query?: string
  ): Promise<SimplifiedLog[]> => {
    if (!query) {
      return [];
    }

    const floorDate = getFloorLogRetentionDateForOrganization(organization);
    const headers = SendgridService.getHeaders(integration);

    // let messageEvents: SimplifiedLog[] = [];
    // await Promise.all([
    //   async () => {
    //     const blocksRes = await axios.get(
    //       BASE_URL + "/suppression/blocks/" + query,
    //       {
    //         headers,
    //       }
    //     );

    //     const { reason, created } = blocksRes.data;
    //     const createdAt = new Date(created * 1000);
    //     if (created && moment(createdAt).isSameOrAfter(floorDate)) {
    //       messageEvents.push({
    //         _id: `sendgrid_${uuid()}`,
    //         content: `Email sent to ${query} was blocked because ${reason}`,
    //         createdAt,
    //         tag: simplifiedLogTagEnum.Error,
    //         sourceTitle: "Sendgrid",
    //       });
    //     }
    //   },
    //   async () => {
    //     const bounceRes = await axios.get(
    //       BASE_URL + "/suppression/bounces/" + query,
    //       {
    //         headers,
    //       }
    //     );

    //     const { reason, created } = bounceRes.data;
    //     const createdAt = new Date(created * 1000);
    //     if (created && moment(createdAt).isSameOrAfter(floorDate)) {
    //       messageEvents.push({
    //         _id: `sendgrid_${uuid()}`,
    //         content: `Email sent to ${query} was bounced because ${reason}`,
    //         createdAt,
    //         tag: simplifiedLogTagEnum.Error,
    //         sourceTitle: "Sendgrid",
    //       });
    //     }
    //   },
    //   async () => {
    //     const suppressionsRes = await axios.get(
    //       BASE_URL + "/suppression/unsubscribes",
    //       {
    //         params: {
    //           start_time: floorDate.getTime() / 1000,
    //           end_time: new Date().getTime() / 1000,
    //         },
    //         headers,
    //       }
    //     );

    //     const suppressions = suppressionsRes.data;
    //     let suppressionForUser = suppressions.find(
    //       (suppression) => suppression.email === query
    //     );
    //     if (!suppressionForUser) {
    //       return;
    //     }

    //     const createdAt = new Date(suppressionForUser.created * 1000);
    //     if (moment(createdAt).isSameOrAfter(floorDate)) {
    //       messageEvents.push({
    //         _id: `sendgrid_${uuid()}`,
    //         content: `${query} unsubscribed from all future emails.`,
    //         createdAt,
    //         tag: simplifiedLogTagEnum.Marketing,
    //         sourceTitle: "Sendgrid",
    //       });
    //     }
    //   },
    // ]);

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
              content:
                `Email to ${query} was ${event.event_name} because ${event.reason}.\n\nEmail subject: ${event.subject}`.slice(
                  0,
                  MAX_NUM_CHARS_ALLOWED_IN_LOG
                ),
              createdAt: new Date(event.processed),
              tag: simplifiedLogTagEnum.Marketing,
              sourceType: integrationTypeEnum.Sendgrid,
            });
          }
        });
      })
    );

    return messageEvents;
  },
};
