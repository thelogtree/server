import axios from "axios";
import _ from "lodash";
import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  OrganizationDocument,
  simplifiedLogTagEnum,
} from "logtree-types";
import moment from "moment";
import { SimplifiedLog } from "src/services/ApiService/lib/LogService";
import { ApiError } from "src/utils/errors";
import { getFloorLogRetentionDateForOrganization } from "src/utils/helpers";

import { SecureIntegrationService } from "../SecureIntegrationService";
import { IntegrationServiceType } from "../types";

const BASE_URL = "https://api.stripe.com/v1";

export const StripeService: IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => {
    const decryptedValue =
      SecureIntegrationService.getDecryptedKeysForIntegration(integration);
    const key = decryptedValue.find((key) => key.type === keyTypeEnum.ApiKey);
    if (!key) {
      throw new ApiError("No Stripe key exists for this organization.");
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
    const headers = StripeService.getHeaders(integration);

    let logs: SimplifiedLog[] = [];

    if (query) {
      const customersRes = await axios.get(BASE_URL + "/customers/search", {
        params: {
          limit: 1,
          query: `email:"${query}"`,
        },
        headers,
      });

      const customer = customersRes.data.data[0];
      if (!customer) {
        return [];
      }

      const res = await axios.get(BASE_URL + "/charges/search", {
        params: {
          limit: 100,
          query: `customer:"${customer.id}"`,
        },
        headers,
      });
      const payments = res.data.data;
      payments.forEach((payment) => {
        logs.push({
          _id: `stripe_${payment.id}`,
          content: `Payment ${payment.status}${
            payment.status === "succeeded" ? " ✅" : ""
          }\n\nAmount: ${
            payment.currency === "usd"
              ? `$${_.round(payment.amount / 100, 2)}`
              : `${payment.amount} of the smallest currency unit for ${payment.currency}`
          }\nCustomer email: ${
            payment.billing_details.email || "n/a"
          }\nCustomer name: ${payment.billing_details.name}\nCustomer ID: ${
            payment.customer || "n/a"
          }\n`,
          createdAt: new Date(payment.created * 1000),
          referenceId: query,
          tag: simplifiedLogTagEnum.Sales,
          sourceType: integrationTypeEnum.Stripe,
          externalLink: `https://dashboard.stripe.com/customers/${payment.customer}`,
        });
      });
    } else {
      const res = await axios.get(BASE_URL + "/charges", {
        params: {
          limit: 100,
        },
        headers,
      });
      const payments = res.data.data;
      payments.forEach((payment) => {
        logs.push({
          _id: `stripe_${payment.id}`,
          content: `Payment ${payment.status}${
            payment.status === "succeeded" ? " ✅" : ""
          }\n\nAmount: ${
            payment.currency === "usd"
              ? `$${_.round(payment.amount / 100, 2)}`
              : `${payment.amount} of the smallest currency unit for ${payment.currency}`
          }\nCustomer email: ${
            payment.billing_details.email || "n/a"
          }\nCustomer name: ${payment.billing_details.name}\nCustomer ID: ${
            payment.customer || "n/a"
          }\n`,
          createdAt: new Date(payment.created * 1000),
          referenceId: payment.billing_details.email,
          tag: simplifiedLogTagEnum.Sales,
          sourceType: integrationTypeEnum.Stripe,
          externalLink: `https://dashboard.stripe.com/customers/${payment.customer}`,
        });
      });
    }

    return logs.filter((event) =>
      moment(event["createdAt"]).isSameOrAfter(floorDate)
    );
  },
};
