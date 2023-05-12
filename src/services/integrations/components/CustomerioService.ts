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
    query: string
  ): Promise<SimplifiedLog[]> => {
    const floorDate = getFloorLogRetentionDateForOrganization(organization);
    const headers = CustomerioService.getHeaders(integration);

    const activitiesRes = await axios.get(
      `${BASE_URL}/customers/${query}/activities`,
      {
        params: {
          id_type: "email",
          limit: 100,
        },
        headers,
      }
    );
    const { activities } = activitiesRes.data;

    const logs: SimplifiedLog[] = activities
      .filter(
        (activity) =>
          moment(new Date(activity.timestamp * 1000)).isSameOrAfter(
            floorDate
          ) &&
          [
            "sent_email",
            "dropped_email",
            "failed_email",
            "spammed_email",
            "bounced_email",
            "delivered_email",
            "clicked_email",
            "opened_email",
            "unsubscribed_email",
            "undeliverable_email",
          ].includes(activity.type) &&
          activity.delivery_type
      )
      .map(
        (activity) =>
          ({
            _id: `customerio_${activity.id}`,
            content:
              `New customer.io event for ${activity.delivery_type} intended to go to ${query}: ${activity.type}\n${activity.name}`.slice(
                0,
                MAX_NUM_CHARS_ALLOWED_IN_LOG
              ),
            createdAt: new Date(activity.timestamp * 1000),
            externalLink: `https://fly.customer.io/journeys/env/${
              (integration.additionalProperties as any).workspaceId
            }/people/${activity.customer_identifiers.cio_id}/activity`,
            tag: simplifiedLogTagEnum.Marketing,
            sourceTitle: "Customer.io",
          } as SimplifiedLog)
      );

    return logs;
  },
};
