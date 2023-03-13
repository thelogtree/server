import faker from "faker";
import merge from "lodash/merge";
import { FolderDocument, OrganizationDocument } from "logtree-types";
import { Log } from "src/models/Log";

import { FolderFactory } from "./FolderFactory";
import { OrganizationFactory } from "./OrganizationFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const folder: FolderDocument = await FolderFactory.create({
    organizationId: organization._id,
  });
  return {
    content: faker.datatype.uuid(),
    organizationId: organization._id,
    folderId: folder._id,
  };
};

export const LogFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Log.create(docFields);
  },
};
