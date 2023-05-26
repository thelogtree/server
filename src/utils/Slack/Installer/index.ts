import {
  Installation,
  InstallationQuery,
  InstallationStore,
  InstallProvider,
  Logger,
} from "@slack/oauth";
import { SlackInstallation } from "src/models/SlackInstallation";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";

const _installationStore: InstallationStore = {
  storeInstallation: async (
    installation: Installation<any, false>,
    _logger?: Logger
  ) => {
    if (installation.team.id) {
      await SlackInstallation.create(installation as any);
    } else {
      throw new ApiError(
        "Failed saving slack installation data because the team could not be identified."
      );
    }
  },
  // @ts-ignore
  fetchInstallation: async (
    installQuery: InstallationQuery<boolean>,
    _logger?: Logger
  ) =>
    SlackInstallation.findOne({
      "team.id": installQuery.teamId,
    }).sort({ createdAt: -1 }),
};

export const slackInstaller = new InstallProvider({
  clientId: config.slack.clientId,
  clientSecret: config.slack.clientSecret,
  stateSecret: config.slack.stateSecret,
  installationStore: _installationStore,
});

// only exported for testing purposes
export const _testExports = {
  installationStore: _installationStore,
};
