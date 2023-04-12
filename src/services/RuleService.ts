import { comparisonTypeEnum } from "logtree-types";
import { Folder } from "src/models/Folder";
import { Rule } from "src/models/Rule";
import { ApiError } from "src/utils/errors";

export const RuleService = {
  createRule: async (
    userId: string,
    organizationId: string,
    folderId: string,
    comparisonType: comparisonTypeEnum,
    comparisonValue: number,
    lookbackTimeInMins: number
  ) => {
    const folderExistsInOrganization = await Folder.exists({
      organizationId,
      _id: folderId,
    });
    if (!folderExistsInOrganization) {
      throw new ApiError("No folder with this ID exists in this organization.");
    }

    return Rule.create({
      userId,
      folderId,
      comparisonType,
      comparisonValue,
      lookbackTimeInMins,
    });
  },
  deleteRule: async (userId: string, ruleId: string) => {
    const ruleExists = await Rule.exists({ userId, _id: ruleId });
    if (!ruleExists) {
      throw new ApiError("Cannot delete a rule that does not exist.");
    }

    await Rule.deleteOne({ _id: ruleId });
  },
  getRulesForUser: (userId: string) =>
    Rule.find({ userId }).sort({ createdAt: -1 }).lean().exec(),
};
