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
import {
  accessValueInMap,
  awaitTimeout,
  getFloorLogRetentionDateForOrganization,
  partitionArray,
} from "src/utils/helpers";
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
    query?: string
  ): Promise<SimplifiedLog[]> => {
    const floorDate = getFloorLogRetentionDateForOrganization(organization);
    const headers = SentryService.getHeaders(integration);

    const projectBatches = partitionArray(
      accessValueInMap(integration.additionalProperties, "projectSlugs"),
      3
    );

    let allEvents: SimplifiedLog[] = [];

    if (query) {
      let issues: any[] = [];
      for (let i = 0; i < projectBatches.length; i++) {
        const batch = projectBatches[i];
        await Promise.all(
          batch.map(async (projectSlug) => {
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
            issues.push(...issuesArray);
          })
        );
      }

      const issuesThatApplyToUser = _.flatten(issues).filter((issue) =>
        moment(issue["lastSeen"]).isSameOrAfter(floorDate)
      );
      const issueBatches = partitionArray(issuesThatApplyToUser, 20);

      for (let i = 0; i < issueBatches.length; i++) {
        if (i > 0) {
          await awaitTimeout(1000); // helps with rate limit rules
        }
        const batch = issueBatches[i];
        await Promise.all(
          batch.map(async (issue: any) => {
            const eventsRes = await axios.get(
              `${BASE_URL}issues/${issue["id"]}/events/`,
              {
                headers,
              }
            );
            const eventsArray = eventsRes.data;
            allEvents.push(
              ...eventsArray
                .filter((event) => event.user?.email === query)
                .map((event) => {
                  const content = `${
                    event.culprit ? `${event.culprit}\n` : ""
                  }${event.title}${
                    issue.metadata.value ? `\n\n${issue.metadata.value}` : ""
                  }`.slice(0, MAX_NUM_CHARS_ALLOWED_IN_LOG);

                  return {
                    _id: `sentry_${event.id}`,
                    content,
                    createdAt: event.dateCreated,
                    tag:
                      event["event.type"] === "error"
                        ? simplifiedLogTagEnum.Error
                        : undefined,
                    externalLink: issue["permalink"],
                    sourceTitle: `Sentry (${issue.project.slug})`,
                  };
                })
            );
          })
        );
      }
    } else {
      let events: any[] = [];
      for (let i = 0; i < projectBatches.length; i++) {
        const batch = projectBatches[i];
        await Promise.all(
          batch.map(async (projectSlug) => {
            const eventsRes = await axios.get(
              `${BASE_URL}projects/${integration.additionalProperties["organizationSlug"]}/${projectSlug}/events/`,
              {
                headers,
              }
            );
            const eventsArr = eventsRes.data;
            events.push(...eventsArr);
          })
        );
      }
      allEvents.push(
        ...events.map((event) => {
          const content = `${event.culprit ? `${event.culprit}\n` : ""}${
            event.title
          }${event.message ? `\n\n${event.message}` : ""}`.slice(
            0,
            MAX_NUM_CHARS_ALLOWED_IN_LOG
          );

          return {
            _id: `sentry_${event.id}`,
            content,
            createdAt: event.dateCreated,
            tag:
              event["event.type"] === "error"
                ? simplifiedLogTagEnum.Error
                : undefined,
            sourceTitle: `Sentry`,
            referenceId: event.user?.email,
          };
        })
      );
    }

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
