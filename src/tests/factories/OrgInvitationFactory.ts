import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import moment from "moment";
import { OrgInvitation } from "src/models/OrgInvitation";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  return {
    expiresAt: moment().add(1, "day").toDate(),
    isOneTimeUse: true,
    organizationId: organization._id,
  };
};

export const OrgInvitationFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return OrgInvitation.create(docFields);
  },
};
