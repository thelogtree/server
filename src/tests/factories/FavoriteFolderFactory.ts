import faker from "faker";
import merge from "lodash/merge";
import { UserDocument } from "logtree-types";
import { FavoriteFolder } from "src/models/FavoriteFolder";

import { UserFactory } from "./UserFactory";

const getDefaultFields = async () => {
  const user: UserDocument = await UserFactory.create();
  const fullPath = "/" + faker.datatype.uuid();
  return {
    fullPath,
    userId: user._id,
  };
};

export const FavoriteFolderFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return FavoriteFolder.create(docFields);
  },
};
