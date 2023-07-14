import {
  IntegrationDocument,
  OrganizationDocument,
  keyTypeEnum,
} from "logtree-types";
import { ApiError } from "src/utils/errors";
import { SecureIntegrationService } from "../SecureIntegrationService";
import axios from "axios";
import { SimplifiedLog } from "src/services/ApiService/lib/LogService";
import _ from "lodash";
import { IntegrationServiceType } from "../types";

type ExtraMongodbServiceTypes = {
  getUserIdFromEmail: (
    integration: IntegrationDocument,
    email: string
  ) => Promise<any>;
};

export const MongodbService: IntegrationServiceType & ExtraMongodbServiceTypes =
  {
    getHeaders: (integration: IntegrationDocument) => {
      const decryptedValue =
        SecureIntegrationService.getDecryptedKeysForIntegration(integration);
      const key = decryptedValue.find((key) => key.type === keyTypeEnum.ApiKey);
      if (!key) {
        throw new ApiError("No MongoDB key exists for this organization.");
      }

      return {
        "api-key": key.plaintextValue,
      };
    },
    getLogs: async (
      organization: OrganizationDocument,
      integration: IntegrationDocument,
      query?: string
    ): Promise<SimplifiedLog[]> => {
      return [];
    },
    getUserIdFromEmail: async (
      integration: IntegrationDocument,
      email: string
    ) => {
      const {
        baseUrl,
        database,
        cluster,
        collection,
        emailKeyField,
        idKeyField,
      } = integration.additionalProperties as any;

      const fullUrl = `${baseUrl}/action/findOne`;
      const headers = MongodbService.getHeaders(integration);

      const res = await axios.post(
        fullUrl,
        {
          dataSource: cluster,
          database,
          collection,
          filter: {
            [`${emailKeyField}`]: email,
          },
        },
        { headers }
      );

      const id = res.data[idKeyField];

      return id;
    },
  };
