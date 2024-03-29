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
              OpenAIUtil.transformLogContextIntoString(contextLogs);

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
            MyLogtree.sendErrorLog({
              error: e,
              additionalContext: {
                organizationSlug: organization.slug,
                integrationId: integration._id.toString(),
              },
            });
          }
        }
      } catch (e: any) {
        MyLogtree.sendErrorLog({
          error: e,
          additionalContext: {
            integrationId: integration._id.toString(),
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
  getSupportLogStrAndInstructions: (supportLog: SimplifiedLog) => {
    const instructions = `Your job is to assist a customer support agent. You will be given a user's message to the agent. You will also be given a list of events representing the user's activity directly prior to the message. The events are in chronological order, so the most recent event is listed first, and the oldest event is listed last. You must analyze the events and give the customer support agent an explanation on why you think the user is experiencing the problem. The events may not refer to the problem directly, so sometimes you will need to make inferences. Never make suggestions to the agent about what to say to the user. It is important to be very concise and only include the most relevant information. If none of the events are related to the user's message, you can say that the user's Logtree logs are unrelated to the user's message. Here is the user's message to the agent, sent at ${supportLog.createdAt}:\n${supportLog.content}\n\nHere are the user's events directly prior to this message:`;
    return instructions;
  },
};
