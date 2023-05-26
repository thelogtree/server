import { InstallationQuery } from "@slack/oauth";
import { WebClient } from "@slack/web-api";
import { IncomingWebhook } from "@slack/webhook";
import { prop } from "lodash/fp";
import { LogDocument, OrganizationDocument } from "logtree-types";
import { config } from "../config";
import { slackInstaller } from "./Installer";
import { PendingSlackInstallation } from "src/models/PendingSlackInstallation";

const _web = new WebClient();

type IntegrationFxnArgs = {
  organization: OrganizationDocument;
  folderPath: string;
  log: LogDocument;
  options: Object | null;
};

export const SlackLib = {
  postToResponseUrl: async (
    responseUrl: string,
    body: {
      text: string;
      response_type?: "ephemeral";
    }
  ) => {
    const webhook = new IncomingWebhook(responseUrl);
    return webhook.send(body);
  },
  postToSlackIntegrationIfExists: async (
    log: LogDocument,
    organization: OrganizationDocument,
    folderPath: string
  ): Promise<void> => {
    const completedInstallations = await PendingSlackInstallation.find({
      isComplete: true,
      folderId: log.folderId,
    })
      .lean()
      .exec();
    if (!completedInstallations.length) {
      return;
    }

    await Promise.all(
      completedInstallations.map(async (installation) => {
        try {
          const { options } = installation;
          const channelId = prop("channelId", options);
          const teamId = prop("teamId", options);
          const message = `New log from ${folderPath}:\n\n${log.content}\n\nView channel: ${config.baseUrl}/org/${organization.slug}/logs${folderPath}`;

          // get bot access token to post message
          const results =
            await slackInstaller.installationStore.fetchInstallation({
              teamId,
            } as InstallationQuery<false>);
          const botAccessToken = prop("bot.token", results);

          await _web.chat.postMessage({
            text: message,
            token: botAccessToken,
            channel: channelId,
          });
        } catch (e) {
          console.error(e);
        }
      })
    );
  },
};

export * from "./Installer";

// only exported for testing purposes
export const _testExports = {
  web: _web,
};
