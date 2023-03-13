import faker from "faker";
import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import { User } from "src/models/User";
import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  return {
    email: faker.internet.email(),
    firebaseId: faker.datatype.uuid(),
    organizationId: organization._id,
  };
};

export const UserFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return User.create(docFields);
  },
};
