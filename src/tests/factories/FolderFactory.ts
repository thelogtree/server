import faker from "faker";
import merge from "lodash/merge";
import { OrganizationDocument } from "logtree-types";
import { Folder } from "src/models/Folder";

import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const name = faker.datatype.uuid();
  return {
    name,
    parentFolder: null,
    organizationId: organization._id,
    fullPath: "/" + name,
  };
};

export const FolderFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Folder.create(docFields);
  },
};
