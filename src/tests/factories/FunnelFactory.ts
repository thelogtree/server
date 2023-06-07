import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import { Funnel } from "src/models/Funnel";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();

  return {
    organizationId: organization._id,
    folderPathsInOrder: ["/test"],
    forwardToChannelPath: "/forwarding-here",
  };
};

export const FunnelFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Funnel.create(docFields);
  },
};
