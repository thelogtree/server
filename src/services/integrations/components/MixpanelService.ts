import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  OrganizationDocument,
  simplifiedLogTagEnum,
} from "logtree-types";
import {
  MAX_NUM_CHARS_ALLOWED_IN_LOG,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import { ApiError } from "src/utils/errors";
import {
  accessValueInMap,
  getFloorLogRetentionDateForOrganization,
} from "src/utils/helpers";

import { SecureIntegrationService } from "../SecureIntegrationService";
import { IntegrationServiceType } from "../types";
import axios from "axios";
import moment from "moment";
import _ from "lodash";

const BASE_URL = "https://mixpanel.com/api/2.0";

export const MixpanelService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const usernameKey = decryptedValue.find(
      (key) => key.type === keyTypeEnum.Username
    );
    const passwordKey = decryptedValue.find(
      (key) => key.type === keyTypeEnum.Password
    );
    if (!usernameKey || !passwordKey) {
      throw new ApiError("No Mixpanel keys exist for this organization.");
    }

    return {
      username: usernameKey.plaintextValue,
      password: passwordKey.plaintextValue,
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
    const auth = MixpanelService.getHeaders(integration);

    const projectId = accessValueInMap(
      integration.additionalProperties,
      "projectId"
    );

    const usersRes = await axios.post(
      BASE_URL + "/engage",
      {
        project_id: projectId,
        where: `user["$email"] == "${query}"`,
        output_properties: [],
      },
      { auth }
    );
    const resultsArray = usersRes.data.results;

    if (!resultsArray.length) {
      return [];
    }

    const userMixpanelId = resultsArray[0]["$distinct_id"];

    const eventsRes = await axios.get(BASE_URL + "/stream/query", {
      params: {
        project_id: projectId,
        distinct_ids: JSON.stringify([userMixpanelId]),
        from_date: moment(floorDate).format("YYYY-MM-DD"),
        to_date: moment().format("YYYY-MM-DD"),
      },
      auth,
    });
    const eventsArray = eventsRes.data.results.events;

    const fieldsToIgnore = [
      "time",
      "distinct_id",
      "mp_country_code",
      "mp_lib",
      "mp_processing_time_ms",
      "anonymousId",
    ];

    return eventsArray
      .filter(
        (eventObj) =>
          eventObj.event[0] !== "$" &&
          eventObj.event !== "Loaded a Page" &&
          eventObj.event !== "Loaded a Screen"
      )
      .map((eventObj) => {
        let eventPropertiesString = "";
        Object.keys(eventObj.properties).forEach((propertyKey) => {
          if (propertyKey[0] !== "$" && !fieldsToIgnore.includes(propertyKey)) {
            eventPropertiesString +=
              (eventPropertiesString === "" ? `\n` : "") +
              `\n${propertyKey}: ${eventObj.properties[propertyKey]}`;
          }
        });
        return {
          _id: `mixpanel_${eventObj.properties["$insert_id"]}`,
          content: `${eventObj.event}${eventPropertiesString}`.slice(
            0,
            MAX_NUM_CHARS_ALLOWED_IN_LOG
          ),
          createdAt: new Date(eventObj.properties.time * 1000),
          tag: simplifiedLogTagEnum.Tracking,
          sourceType: integrationTypeEnum.Mixpanel,
        } as SimplifiedLog;
      });
  },
};
