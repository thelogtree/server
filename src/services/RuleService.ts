import {
  RuleDocument,
  UserDocument,
  comparisonTypeEnum,
  notificationTypeEnum,
} from "logtree-types";
import { Folder } from "src/models/Folder";
import { Rule } from "src/models/Rule";
import { ApiError } from "src/utils/errors";
import { StatsService } from "./StatsService";
import _ from "lodash";
import { Organization } from "src/models/Organization";
import { config } from "src/utils/config";
import { SendgridUtil } from "src/utils/sendgrid";
import moment from "moment";
import { Logger } from "src/utils/logger";
import { getErrorMessage } from "src/utils/helpers";
import { User } from "src/models/User";
import { TwilioUtil } from "src/utils/twilio";

export const RuleService = {
  createRule: async (
    userId: string,
    organizationId: string,
    folderId: string,
    comparisonType: comparisonTypeEnum,
    comparisonValue: number,
    lookbackTimeInMins: number,
    notificationType: notificationTypeEnum = notificationTypeEnum.Email
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
      notificationType,
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
    if (
      rule.lastTriggeredAt &&
      moment().diff(moment(rule.lastTriggeredAt), "minutes") <=
        rule.lookbackTimeInMins
    ) {
      // do not trigger rule if it was just triggered because we need the data to refresh first
      return false;
    }

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
  getRuleAlertMessageBody: async (rule: RuleDocument) => {
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

    const organization = await Organization.findById(folder?.organizationId, {
      slug: 1,
      _id: 0,
    })
      .lean()
      .exec();

    return `You are receiving this alert because the number of logs in ${folder?.fullPath} has ${comparisonLanguage} ${comparisonValue} in the last ${duration}.\n\nYou can view the logs in this channel here: ${config.baseUrl}/org/${organization?.slug}/logs${folder?.fullPath}`;
  },
  executeTriggeredRule: async (rule: RuleDocument, user: UserDocument) => {
    const message = await RuleService.getRuleAlertMessageBody(rule);

    if (rule.notificationType === notificationTypeEnum.Email) {
      await SendgridUtil.sendEmail({
        to: user.email,
        subject: `Logtree Alert`,
        text: message,
      });
    } else if (
      user.phoneNumber &&
      rule.notificationType === notificationTypeEnum.SMS
    ) {
      await TwilioUtil.sendMessage(user.phoneNumber, message);
    } else if (rule.notificationType === notificationTypeEnum.SMS) {
      throw new ApiError(
        "Rule execution failed because it was an SMS rule but the user has no phone number."
      );
    }

    await Rule.updateOne(
      { _id: rule._id },
      {
        numberOfTimesTriggered: rule.numberOfTimesTriggered + 1,
        lastTriggeredAt: new Date(),
      }
    );
  },
  checkRulesAndExecuteIfNecessary: async (folderId: string) => {
    const unpopulatedRules = await Rule.find({ folderId }).lean().exec();
    const users = await User.find({
      _id: { $in: unpopulatedRules.map((rule) => rule.userId) },
    })
      .lean()
      .exec();
    // doing a .populate on userId manually
    const hydratedRules = unpopulatedRules.map((rule) => {
      const userId = users.find(
        (user) => user._id.toString() === rule.userId.toString()
      ) as UserDocument;
      return {
        ...rule,
        userId,
      };
    });

    await Promise.all(
      hydratedRules.map(async (rule) => {
        try {
          const isTriggered = await RuleService.isRuleTriggered(
            rule as RuleDocument
          );
          if (isTriggered) {
            // send email to the user attached to this rule
            const user = rule.userId as UserDocument;
            await RuleService.executeTriggeredRule(rule as RuleDocument, user);
          }
        } catch (e: any) {
          Logger.sendLog(
            getErrorMessage(e),
            "/errors",
            (rule.userId as UserDocument).email
          );
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
