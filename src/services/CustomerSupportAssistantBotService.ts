import { integrationTypeEnum } from "logtree-types";
import { Integration } from "src/models/Integration";
import { Organization } from "src/models/Organization";
import { IntercomService } from "src/services/integrations/index";
import {
  LogService,
  SimplifiedLog,
} from "src/services/ApiService/lib/LogService";
import moment from "moment";
import { OpenAIUtil } from "src/utils/openai";
import { MyLogtree } from "src/utils/logger";
import { config } from "src/utils/config";
import { getErrorMessage } from "src/utils/helpers";

// just for beta
const orgSlugsParticipating = ["fizz"];

export const CustomerSupportAssistantBotService = {
  runCron: async () => {
    const organizations = await Organization.find({
      slug: { $in: orgSlugsParticipating },
    }).exec();
    const supportIntegrations = await Integration.find({
      type: integrationTypeEnum.Intercom,
      organizationId: { $in: organizations.map((org) => org._id) },
    }).exec();

    for (const integration of supportIntegrations) {
      try {
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
          try {
            const specificUserEmail = recentSupportLog.referenceId;
            if (!specificUserEmail) {
              continue;
            }

            const moreRecentSupportLogForThisUserExists =
              !!supportLogsFromLastCoupleMins.find(
                (log) =>
                  log.referenceId === specificUserEmail &&
                  moment(log.createdAt).isAfter(
                    moment(recentSupportLog.createdAt)
                  )
              );
            if (moreRecentSupportLogForThisUserExists) {
              // ignore this log because we don't want to clutter intercom with notes
              continue;
            }

            const isWorthRespondingTo =
              await OpenAIUtil.getIsSupportMessageWorthRespondingTo(
                recentSupportLog.content
              );

            if (!isWorthRespondingTo) {
              continue;
            }

            const allLogsForSpecificUser = await LogService.getSupportLogs(
              organization,
              specificUserEmail
            );

            void MyLogtree.sendLog({
              content: `${allLogsForSpecificUser.length} logs found for ${specificUserEmail}`,
              folderPath: "/support-bot-responses",
            });

            if (!allLogsForSpecificUser.length) {
              continue;
            }

            const contextLogs =
              CustomerSupportAssistantBotService.getContextLogsToEvaluate(
                allLogsForSpecificUser,
                recentSupportLog
              );

            void MyLogtree.sendLog({
              content: `${contextLogs.length} logs will be used as context for the support bot's response for ${specificUserEmail}`,
              folderPath: "/support-bot-responses",
            });

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
              await OpenAIUtil.getCompletionForCustomerSupportBot(
                logContextAsString,
                instructions
              );

            void MyLogtree.sendLog({
              content: `(${organization.name})\n\nSupport message: ${recentSupportLog.content}\n\nBot response: '${completionBotResponse}'`,
              folderPath: "/support-bot-responses",
              externalLink: `${config.baseUrl}/org/${organization.slug}/journey?query=${specificUserEmail}`,
            });

            const areLogsRelevant = await OpenAIUtil.getAreLogsRelatedToMessage(
              completionBotResponse || ""
            );

            if (!areLogsRelevant) {
              continue;
            }

            const conversationId = recentSupportLog._id
              .toString()
              .split("_")[1];
            const adminId = adminIdsForOrg[0];
            const logtreeJourneyLink =
              config.baseUrl +
              `/org/${organization.slug}/journey?query=${specificUserEmail}`;

            await IntercomService.sendNote(
              integration,
              conversationId,
              adminId,
              completionBotResponse || "",
              logtreeJourneyLink,
              recentSupportLog.content
            );
          } catch (e: any) {
            MyLogtree.sendLog({
              content: getErrorMessage(e),
              folderPath: "/errors",
              additionalContext: {
                integrationId: integration._id.toString(),
                wasInside: true,
              },
            });
          }
        }
      } catch (e: any) {
        MyLogtree.sendLog({
          content: getErrorMessage(e),
          folderPath: "/errors",
          additionalContext: {
            integrationId: integration._id.toString(),
            wasInside: false,
          },
        });
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

    // currently adding 28 surrounding logs as context
    const upperBound = Math.min(allLogs.length, lowerBound + 28);

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
    const instructions = `Your job is to help a customer support agent address a user's problem or question. You will be given the user's inbound chat message from the company's customer support tool and you will also be given a list of events in chronological order that the company recorded about the user's actions directly prior to the user messaging in. The most recent event is listed first, and the oldest event is listed last. Your job is to look through these events and try to write an insightful note to the customer support agent about what the events say about the user's problem or question. If the events have nothing to do with what the user messaged in with, you can say that the user's Logtree logs are unrelated to the user's message. Write your response as if you are speaking directly to the support agent. Never suggest that the user contacts anyone else since they are already speaking to support. Be very concise and only tell the customer support agent the most important things. Do not explain the user's message since the customer support agent has already read it. Here is the user's message, sent at ${supportLog.createdAt}:\n${supportLog.content}\n\nHere are the user's events directly prior to this message:`;
    return instructions;
  },
};
