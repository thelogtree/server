import { integrationTypeEnum } from "logtree-types";
import { Integration } from "src/models/Integration";
import { Organization } from "src/models/Organization";
import { IntercomService } from "src/services/integrations/index";
import {
  LogService,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import moment from "moment";
import { OpenAI } from "src/utils/openai";
import { MyLogtree } from "src/utils/logger";
import { config } from "src/utils/config";

// just for beta
const orgSlugsParticipating = ["fizz"];

export const CustomerSupportAssistantBotService = {
  runCron: async () => {
    const organizations = await Organization.find({
      slug: { $in: orgSlugsParticipating },
    })
      .lean()
      .exec();
    const supportIntegrations = await Integration.find({
      type: integrationTypeEnum.Intercom,
      organizationId: { $in: organizations.map((org) => org._id) },
    }).exec();

    for (const integration of supportIntegrations) {
      const organization = organizations.find(
        (org) => org._id.toString() === integration.organizationId.toString()
      );
      if (!organization) {
        continue;
      }

      const adminIdsForOrg = await IntercomService.getAdminIds(integration);
      if (!adminIdsForOrg.length) {
        // can't send a note because there are no intercom admins, no point in continuing
        continue;
      }

      const supportLogsFromLastCoupleMins =
        await IntercomService.getLogsForSupportBot(integration);

      for (const recentSupportLog of supportLogsFromLastCoupleMins) {
        const specificUserEmail = recentSupportLog.referenceId;
        if (!specificUserEmail) {
          continue;
        }

        const moreRecentSupportLogForThisUserExists =
          !!supportLogsFromLastCoupleMins.find(
            (log) =>
              log.referenceId === specificUserEmail &&
              moment(log.createdAt).isAfter(moment(recentSupportLog.createdAt))
          );
        if (moreRecentSupportLogForThisUserExists) {
          // ignore this log because we don't want to clutter intercom with notes
          continue;
        }

        const allLogsForSpecificUser = await LogService.getSupportLogs(
          organization,
          specificUserEmail
        );
        if (!allLogsForSpecificUser.length) {
          continue;
        }

        const contextLogs =
          CustomerSupportAssistantBotService.getContextLogsToEvaluate(
            allLogsForSpecificUser,
            recentSupportLog
          );
        if (!contextLogs.length) {
          continue;
        }

        const logContextAsString =
          CustomerSupportAssistantBotService.transformLogContextIntoString(
            contextLogs
          );

        const instructions =
          CustomerSupportAssistantBotService.getSupportLogStrAndInstructions(
            recentSupportLog
          );

        const completionBotResponse =
          await OpenAI.getCompletionForCustomerSupportBot(
            logContextAsString,
            instructions
          );

        void MyLogtree.sendLog({
          content: `(${organization.name})\n\nSupport message: ${recentSupportLog.content}\n\nBot response: '${completionBotResponse}'`,
          folderPath: "/support-bot-responses",
          externalLink: `${config.baseUrl}/org/${organization.slug}/journey?query=${specificUserEmail}`,
        });

        const conversationId = recentSupportLog._id.toString().split("_")[1];
        const adminId = adminIdsForOrg[0];
        const logtreeJourneyLink =
          config.baseUrl +
          `/org/${organization.slug}/journey?query=${specificUserEmail}`;
        await IntercomService.sendNote(
          integration,
          conversationId,
          adminId,
          completionBotResponse || "",
          logtreeJourneyLink
        );
      }
    }
  },
  getContextLogsToEvaluate: (
    allLogs: SimplifiedLog[],
    specificSupportLog: SimplifiedLog
  ): SimplifiedLog[] => {
    let indexOfSpecificSupportLog = -1;
    for (let i = 0; i < allLogs.length; i++) {
      if (allLogs[i]._id === specificSupportLog._id) {
        indexOfSpecificSupportLog = i;
      }
    }

    if (
      indexOfSpecificSupportLog === -1 ||
      indexOfSpecificSupportLog === allLogs.length - 1
    ) {
      return [];
    }

    // right after the user messages in
    const lowerBound = indexOfSpecificSupportLog + 1;

    // currently adding 20 surrounding logs as context
    const upperBound = Math.min(allLogs.length, indexOfSpecificSupportLog + 20);

    return allLogs.slice(lowerBound, upperBound);
  },
  transformLogContextIntoString: (logContext: SimplifiedLog[]) => {
    let str = "------";

    logContext.forEach((log) => {
      if (str.length > 6) {
        str += "\n------\n";
      }
      str += `Log from ${log.sourceTitle} (${
        log.tag || "logging"
      } service) recorded at ${log.createdAt}:\n`;
      str += `${log.content.replace(/(\r\n|\n|\r)/gm, "")}`;
    });

    return str;
  },
  getSupportLogStrAndInstructions: (supportLog: SimplifiedLog) => {
    const instructions = `Your name is Logtree Bot. Your job is to help a customer support agent address a user's problem or question. You will be given the user's inbound chat message from the company's customer support tool and you will also be given a list of events that the company recorded about the user's actions directly prior to the user messaging in. Your job is to look through these events and try to write an insightful and concise note to the customer support agent about what the events say about the user's problem or question. If the events have nothing to do with what the user messaged in with, you can say that the user's Logtree logs are unrelated to the user's message. Write your response as if you are speaking directly to the support agent. Never suggest that the user contacts anyone else since they are already speaking to them. Here is the user's message, sent at ${supportLog.createdAt}:\n${supportLog.content}\n\nHere are the user's events directly prior to this message:`;
    return instructions;
  },
};
