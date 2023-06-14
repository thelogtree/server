import faker from "faker";
import merge from "lodash/merge";
import { RouteMonitorDocument } from "logtree-types";
import { RouteMonitorSnapshot } from "src/models/RouteMonitorSnapshot";

import { RouteMonitorFactory } from "./RouteMonitorFactory";

const getDefaultFields = async () => {
  const routeMonitor: RouteMonitorDocument = await RouteMonitorFactory.create();
  const path = faker.datatype.uuid();
  return {
    path,
    numCalls: 1,
    routeMonitorId: routeMonitor._id,
    organizationId: routeMonitor.organizationId,
  };
};

export const RouteMonitorSnapshotFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return RouteMonitorSnapshot.create(docFields);
  },
};
