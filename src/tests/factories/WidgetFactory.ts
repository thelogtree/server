import faker from "faker";
import merge from "lodash/merge";
import {
  DashboardDocument,
  OrganizationDocument,
  widgetType,
} from "logtree-types";
import { Widget } from "src/models/Widget";

import { DashboardFactory } from "./DashboardFactory";
import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const dashboard: DashboardDocument = await DashboardFactory.create();
  const title = faker.datatype.uuid();
  return {
    title,
    organizationId: organization._id,
    dashboardId: dashboard._id,
    type: widgetType.Logs,
    folderPaths: [{ fullPath: "/test", overrideEventName: null }],
    position: {
      x: 7,
      y: 8,
    },
    size: {
      width: 300,
      height: 250,
    },
  };
};

export const WidgetFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Widget.create(docFields);
  },
};
