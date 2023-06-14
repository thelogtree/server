import faker from "faker";
import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import { RouteMonitor } from "src/models/RouteMonitor";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const path = faker.datatype.uuid();
  return {
    path,
    numCalls: 1,
    organizationId: organization._id,
  };
};

export const RouteMonitorFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return RouteMonitor.create(docFields);
  },
};
