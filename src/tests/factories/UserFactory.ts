import faker from "faker";
import merge from "lodash/merge";
import { OrgInvitationDocument, OrganizationDocument } from "logtree-types";
import { User } from "src/models/User";
import { OrganizationFactory } from "./OrganizationFactory";
import { OrgInvitationFactory } from "./OrgInvitationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const orgInvitation: OrgInvitationDocument =
    await OrgInvitationFactory.create({ organizationId: organization._id });
  return {
    email: faker.internet.email(),
    firebaseId: faker.datatype.uuid(),
    organizationId: organization._id,
    invitationId: orgInvitation._id,
  };
};

export const UserFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return User.create(docFields);
  },
};
