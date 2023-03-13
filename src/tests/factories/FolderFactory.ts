import faker from "faker";
import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import { Folder } from "src/models/Folder";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  return {
    name: faker.datatype.uuid(),
    parentFolder: null,
    organizationId: organization._id,
  };
};

export const FolderFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Folder.create(docFields);
  },
};
