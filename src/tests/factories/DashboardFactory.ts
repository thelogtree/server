import faker from "faker";
import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import { Dashboard } from "src/models/Dashboard";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const title = faker.datatype.uuid();
  return {
    title,
    organizationId: organization._id,
  };
};

export const DashboardFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Dashboard.create(docFields);
  },
};
