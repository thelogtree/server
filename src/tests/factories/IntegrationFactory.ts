import merge from "lodash/merge";
import { integrationTypeEnum, OrganizationDocument } from "logtree-types";
import { Integration } from "src/models/Integration";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  return {
    organizationId: organization._id,
    type: integrationTypeEnum.Sentry,
    keys: [],
  };
};

export const IntegrationFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Integration.create(docFields);
  },
};
