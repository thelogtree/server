import merge from "lodash/merge";
import {
  comparisonTypeEnum,
  FolderDocument,
  notificationTypeEnum,
  OrganizationDocument,
  UserDocument,
} from "logtree-types";
import { Rule } from "src/models/Rule";

import { FolderFactory } from "./FolderFactory";
import { OrganizationFactory } from "./OrganizationFactory";
import { UserFactory } from "./UserFactory";

const getDefaultFields = async () => {
  const organization: OrganizationDocument = await OrganizationFactory.create();
  const user: UserDocument = await UserFactory.create({
    organizationId: organization._id,
  });
  const folder: FolderDocument = await FolderFactory.create({
    organizationId: organization._id,
  });
  return {
    userId: user._id,
    folderId: folder._id,
    organizationId: organization._id,
    comparisonType: comparisonTypeEnum.CrossesAbove,
    comparisonValue: 10,
    lookbackTimeInMins: 60,
    notificationType: notificationTypeEnum.Email,
  };
};

export const RuleFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    return Rule.create(docFields);
  },
};
