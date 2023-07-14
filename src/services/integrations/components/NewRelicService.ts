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

const BASE_URL = "https://api.newrelic.com/v2";

export const NewRelicService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find((key) => key.type === keyTypeEnum.ApiKey);
    if (!key) {
      throw new ApiError("No Sentry key exists for this organization.");
    }

    return {
      "X-Api-Key": key.plaintextValue,
    };
  },
  getLogs: async (
    organization: OrganizationDocument,
    integration: IntegrationDocument,
    query?: string
  ): Promise<SimplifiedLog[]> => {
    const floorDate = getFloorLogRetentionDateForOrganization(organization);
    const headers = NewRelicService.getHeaders(integration);

    const userId = await SecureIntegrationService.getUserIdFromEmail(
      organization._id.toString(),
      query || ""
    );

    if (!userId) {
      return [];
    }

    const res = await axios.get(
      `${BASE_URL}/applications/${integration.additionalProperties.get(
        "appId"
      )}/metrics/data.json`,
      {
        headers,
        params: {
          query: `SELECT * FROM Log WHERE ${integration.additionalProperties.get(
            "userIdField"
          )} = '${userId}'`,
          from: floorDate.toISOString(),
          to: new Date().toISOString(),
          sort: "timestamp desc",
          limit: 300,
        },
      }
    );

    const { logs } = res.data;

    const events = logs.map((log, i) => {
      const content = `${log.method} ${log.url}${
        log.status ? ` (${log.status})` : ""
      }`.slice(0, MAX_NUM_CHARS_ALLOWED_IN_LOG);
      const additionalContext = log;
      return {
        _id: `newrelic_${i}`,
        content,
        createdAt: new Date(log.timestamp),
        tag: simplifiedLogTagEnum.Tracking,
        sourceTitle: `New Relic`,
        referenceId: query,
        additionalContext,
      };
    });

    return events.filter((event) =>
      moment(event["createdAt"]).isSameOrAfter(floorDate)
    );
  },
};
