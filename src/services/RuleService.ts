import { RuleDocument, UserDocument, comparisonTypeEnum } from "logtree-types";
import { Folder } from "src/models/Folder";
import { Rule } from "src/models/Rule";
import { ApiError } from "src/utils/errors";
import { StatsService } from "./StatsService";
import _ from "lodash";
import { Organization } from "src/models/Organization";
import { config } from "src/utils/config";
import { SendgridUtil } from "src/utils/sendgrid";

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
  isRuleTriggered: async (rule: RuleDocument): Promise<boolean> => {
    const vals = await StatsService.getLogFrequenciesByInterval(
      rule.folderId.toString(),
      rule.lookbackTimeInMins,
      2,
      true
    );
    let finalArr = vals;
    if (vals.length === 1) {
      finalArr = [vals[0], 0];
    } else if (vals.length === 0) {
      finalArr = [0, 0];
    }

    if (rule.comparisonType === comparisonTypeEnum.CrossesAbove) {
      return (
        finalArr[0] > rule.comparisonValue &&
        finalArr[1] <= rule.comparisonValue
      );
    }
    if (rule.comparisonType === comparisonTypeEnum.CrossesBelow) {
      return (
        finalArr[0] < rule.comparisonValue &&
        finalArr[1] >= rule.comparisonValue
      );
    }
    return false;
  },
  getRuleEmailBody: async (rule: RuleDocument) => {
    const { lookbackTimeInMins, comparisonType, folderId, comparisonValue } =
      rule;
    const folder = await Folder.findById(folderId, {
      fullPath: 1,
      organizationId: 1,
      _id: 0,
    })
      .lean()
      .exec();
    const comparisonLanguage =
      comparisonType === comparisonTypeEnum.CrossesAbove
        ? "crossed above"
        : "crossed below";

    let duration;
    if (lookbackTimeInMins >= 10080) {
      const val = _.round(lookbackTimeInMins / 10080, 1);
      duration = `${val} ${val === 1 ? "week" : "weeks"}`;
    } else if (lookbackTimeInMins >= 2460) {
      const val = _.round(lookbackTimeInMins / 2460, 1);
      duration = `${val} ${val === 1 ? "day" : "days"}`;
    } else if (lookbackTimeInMins >= 60) {
      const val = _.round(lookbackTimeInMins / 60, 1);
      duration = `${val} ${val === 1 ? "hour" : "hour"}`;
    } else {
      const val = _.round(lookbackTimeInMins / 1, 1);
      duration = `${val} ${val === 1 ? "minute" : "minutes"}`;
    }

    const organization = await Organization.findById(folder.organizationId, {
      slug: 1,
      _id: 0,
    })
      .lean()
      .exec();

    return `You are receiving this alert because the number of logs in ${folder.fullPath} has ${comparisonLanguage} ${comparisonValue} in the last ${duration}.\n\nYou can view the logs in this channel here: ${config.baseUrl}/org/${organization.slug}/logs${folder.fullPath}`;
  },
  executeTriggeredRule: async (rule: RuleDocument, user: UserDocument) => {
    const text = await RuleService.getRuleEmailBody(rule);
    await SendgridUtil.sendEmail({
      to: user.email,
      subject: `Logtree Alert`,
      text,
    });

    await Rule.updateOne(
      { _id: rule._id },
      {
        numberOfTimesTriggered: rule.numberOfTimesTriggered + 1,
        lastTriggeredAt: new Date(),
      }
    );
  },
  checkRulesAndExecuteIfNecessary: async (folderId: string) => {
    const rules = await Rule.find({ folderId })
      .populate("userId")
      .lean()
      .exec();
    await Promise.all(
      rules.map(async (rule) => {
        const isTriggered = await RuleService.isRuleTriggered(rule);
        if (isTriggered) {
          // send email to the user attached to this rule
          const user = rule.userId as UserDocument;
          await RuleService.executeTriggeredRule(rule, user);
        }
      })
    );
  },
  runAllRulesForOrganization: async (organizationId: string) => {
    const folders = await Folder.find({ organizationId }, { _id: 1 })
      .lean()
      .exec();
    await Promise.all(
      folders.map((folder) =>
        RuleService.checkRulesAndExecuteIfNecessary(folder._id.toString())
      )
    );
  },
};
