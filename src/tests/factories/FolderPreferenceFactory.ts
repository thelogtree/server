import faker from "faker";
import merge from "lodash/merge";
import { UserDocument } from "logtree-types";

import { UserFactory } from "./UserFactory";
import { FolderPreference } from "src/models/FolderPreference";

const getDefaultFields = async () => {
  const user: UserDocument = await UserFactory.create();
  const fullPath = "/" + faker.datatype.uuid();
  return {
    fullPath,
    userId: user._id,
  };
};

export const FolderPreferenceFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return FolderPreference.create(docFields);
  },
};
