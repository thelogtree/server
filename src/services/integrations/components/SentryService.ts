import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
} from "logtree-types";
import { Integration } from "src/models/Integration";
import { ApiError } from "src/utils/errors";
import { SecureIntegrationService } from "../SecureIntegrationService";
import axios from "axios";

const BASE_URL = "https://sentry.io/api/0/projects/";

export const SentryService = {
  getAuthorizationHeader: async (organizationId: string) => {
    const NO_KEY_MESSAGE = "No Sentry key exists for this organization.";
    const integration = await Integration.findOne({
      organizationId,
      type: integrationTypeEnum.Sentry,
    })
      .lean()
      .exec();
    if (!integration) {
      throw new ApiError(NO_KEY_MESSAGE);
    }

    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find(
      (key) => key.type === keyTypeEnum.AuthToken
    );
    if (!key) {
      throw new ApiError(NO_KEY_MESSAGE);
    }

    return {
      Authorization: `Bearer ${key.plaintextValue}`,
    };
  },
  refreshProjectConnections: async (integration: IntegrationDocument) => {
    const authHeaders = await SentryService.getAuthorizationHeader(
      integration.organizationId.toString()
    );
    const res = await axios.get(BASE_URL, {
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
