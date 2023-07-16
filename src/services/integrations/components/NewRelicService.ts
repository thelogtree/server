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

const BASE_URL = "https://api.newrelic.com/graphql";

export const NewRelicService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find((key) => key.type === keyTypeEnum.ApiKey);
    if (!key) {
      throw new ApiError("No Sentry key exists for this organization.");
    }

    return {
      "API-Key": key.plaintextValue,
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

    const res = await axios.get(BASE_URL, {
      headers,
      params: {
        query: `{ actor { account(id: ${integration.additionalProperties.get(
          "accountId"
        )}) { nrql(query: "SELECT * FROM Log WHERE ${integration.additionalProperties.get(
          "userIdField"
        )} = '${userId}' SINCE '${floorDate.toISOString()}' UNTIL '${new Date().toISOString()}' ORDER BY timestamp DESC LIMIT 300\") { results } } } }`,
      },
    });

    const logs = res.data.data.actor.account.nrql.results;

    const events = logs.map((log, i) => {
      const content = log.url
        ? `${log.method ? `${log.method} ` : ""}${log.url}${
            log.status ? ` (${log.status})` : ""
          }`
        : log.message;
      const additionalContext = log;
      return {
        _id: `newrelic_${i}`,
        content: content.slice(0, MAX_NUM_CHARS_ALLOWED_IN_LOG),
        createdAt: new Date(log.timestamp),
        tag: simplifiedLogTagEnum.Tracking,
        sourceType: integrationTypeEnum.NewRelic,
        referenceId: query,
        additionalContext,
      };
    });

    return events.filter((event) =>
      moment(event["createdAt"]).isSameOrAfter(floorDate)
    );
  },
};
