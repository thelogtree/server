import merge from "lodash/merge";
import { integrationTypeEnum, OrganizationDocument } from "logtree-types";

import { OrganizationFactory } from "./OrganizationFactory";
import { OAuthRequest } from "src/models/OAuthRequest";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  return {
    organizationId: organization._id,
    source: integrationTypeEnum.Intercom,
    isComplete: false,
  };
};

export const OAuthRequestFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return OAuthRequest.create(docFields);
  },
};
