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
import { SimplifiedLog } from "src/services/ApiService/lib/LogService";
import _ from "lodash";
import { IntegrationServiceType } from "../types";
import {
  getFloorLogRetentionDateForOrganization,
  partitionArray,
} from "src/utils/helpers";
import { DateTime } from "luxon";
import { Organization } from "src/models/Organization";
import moment from "moment";

const BASE_URL = "https://sentry.io/api/0/";

export const SentryService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find(
      (key) => key.type === keyTypeEnum.AuthToken
    );
    if (!key) {
      throw new ApiError("No Sentry key exists for this organization.");
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
    const headers = SentryService.getHeaders(integration);
    // right now it only does the request for the first 3 connected projects because of sentry's rate limit.
    // todo: make it so it does 3 requests every 1 second (spaces out the requests to adhere to the rate limit)
    // make that a fxn too so you can reuse it for other integrations
    const issuesForEachProject: string[][] = await Promise.all(
      integration.additionalProperties["projectSlugs"]
        .slice(0, 3)
        .map(async (projectSlug) => {
          const issuesRes = await axios.get(
            `${BASE_URL}projects/${integration.additionalProperties["organizationSlug"]}/${projectSlug}/issues/`,
            {
              params: {
                query: `user.email:${query}`,
              },
              headers,
            }
          );
          const issuesArray = issuesRes.data;
          return issuesArray;
        })
    );
    const issuesThatApplyToUser = _.flatten(issuesForEachProject);
    const issueBatches = partitionArray(issuesThatApplyToUser, 5);

    let allEvents: SimplifiedLog[] = [];
    for (const batch of issueBatches) {
      const events: SimplifiedLog[][] = await Promise.all(
        batch.map(async (issue: any) => {
          const eventsRes = await axios.get(
            `${BASE_URL}issues/${issue["id"]}/events/`,
            {
              headers,
            }
          );
          const eventsArray = eventsRes.data;
          return eventsArray
            .filter((event) => event.user?.email === query)
            .map((event) => ({
              _id: `sentry_${event["id"]}_${event.id}`,
              content: event.title,
              createdAt: event.dateCreated,
              tag: simplifiedLogTagEnum.Error,
              externalLink: issue["permalink"],
              sourceTitle: `Sentry (${issue.project.slug})`,
            }));
        })
      );
      const logsForUser = _.flatten(events);
      allEvents.push(...logsForUser);
    }

    const floorDate = getFloorLogRetentionDateForOrganization(organization);

    return allEvents.filter((event) =>
      moment(event["createdAt"]).isSameOrAfter(floorDate)
    );
  },
  finishConnection: async (integration: IntegrationDocument) => {
    const authHeaders = await SentryService.getHeaders(integration);
    const res = await axios.get(BASE_URL + "projects/", {
      headers: authHeaders,
    });
    const resultArray = res.data;

    const organizationSlug = resultArray.length
      ? resultArray[0].organization.slug
      : null;
    const projectSlugs = resultArray.map((project) => project.slug);

    await Integration.updateOne(
      { _id: integration._id },
      {
        additionalProperties: {
          organizationSlug,
          projectSlugs,
        },
      }
    );
  },
};
