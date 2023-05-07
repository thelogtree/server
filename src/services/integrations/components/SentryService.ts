import {
  IntegrationDocument,
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

const BASE_URL = "https://sentry.io/api/0/";

export const SentryService: IntegrationServiceType = {
  getHeaders: async (integration: IntegrationDocument) => {
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
    integration: IntegrationDocument,
    query: string
  ): Promise<SimplifiedLog[]> => {
    const issuesForEachProject: SimplifiedLog[][] = await Promise.all(
      integration.additionalProperties["projectSlugs"].map(
        async (projectSlug) => {
          const issuesRes = await axios.get(
            `projects/${integration.additionalProperties["organizationSlug"]}/${projectSlug}/issues/`,
            {
              params: {
                query: `user.email:${query}`,
              },
            }
          );
          const issuesArray = issuesRes.data;
          return issuesArray.map(
            (issue) =>
              ({
                _id: issue.id,
                content: issue.title,
                createdAt: new Date(issue.lastSeen),
                externalLink: issue.permalink,
                tag: simplifiedLogTagEnum.Error,
              } as SimplifiedLog)
          );
        }
      )
    );
    const logsForUser = _.flatten(issuesForEachProject);

    return logsForUser;
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
