import { Request, Response } from "express";
import moment from "moment";
import { Folder } from "src/models/Folder";
import { PendingSlackInstallation } from "src/models/PendingSlackInstallation";
import { config } from "src/utils/config";
import { MyLogtree } from "src/utils/logger";
import { slackInstaller, SlackLib } from "src/utils/Slack";

export const SlackController = {
  handleOauthRedirect: async (req: Request, res: Response) => {
    slackInstaller.handleCallback(req, res);
  },
  handleGetInstallationUrl: async (req: Request, res: Response) => {
    const installationUrl = await slackInstaller.generateInstallUrl({
      scopes: ["chat:write", "chat:write.public", "commands"],
      redirectUri: config.slack.redirectUri,
    });

    const pendingInstallation = await PendingSlackInstallation.create({
      folderId: req.query.folderId?.toString() as string,
    });
    res.send({
      installationUrl,
      installationCode: pendingInstallation._id.toString(),
    });
  },
  handleSlashCommand: async (req: Request, res: Response) => {
    const { command, text, channel_id, team_id, response_url } = req.body;

    switch (command) {
      case "/subscribe": {
        if (!text) {
          SlackLib.postToResponseUrl(response_url, {
            text: "Please provide your one-time installation code.",
            response_type: "ephemeral",
          });
          break;
        }

        const weekOld = moment().subtract(1, "day").toDate();
        const pendingInstallation = await PendingSlackInstallation.findOne({
          _id: text,
          createdAt: { $gte: weekOld },
          isComplete: false,
        })
          .lean()
          .exec();
        const folder = pendingInstallation
          ? await Folder.findById(pendingInstallation?.folderId)
          : null;

        if (!pendingInstallation || !folder) {
          SlackLib.postToResponseUrl(response_url, {
            text: "That installation code is invalid.",
            response_type: "ephemeral",
          });
          break;
        }

        await PendingSlackInstallation.updateOne(
          { _id: pendingInstallation._id },
          {
            isComplete: true,
            options: {
              channelId: channel_id,
              teamId: team_id,
            },
          }
        );

        MyLogtree.sendLog({
          content: `Someone set up log forwarding from Logtree to Slack for folderPath ${folder.fullPath}`,
          folderPath: "/slack-installation",
          additionalContext: {
            orgId: folder.organizationId,
            folderPath: folder.fullPath,
            folderCreatedWhen: folder.createdAt,
          },
        });

        SlackLib.postToResponseUrl(response_url, {
          text: `You've successfully connected the Logtree channel ${folder.fullPath} to this Slack channel! We'll start forwarding future logs automatically.`,
          response_type: "ephemeral",
        });
        break;
      }

      case "/unsubscribe": {
        if (!text) {
          SlackLib.postToResponseUrl(response_url, {
            text: "Please provide the folderPath you would like to unsubscribe from.",
            response_type: "ephemeral",
          });
          break;
        }

        const folder = await Folder.findOne({ fullPath: text }).lean().exec();
        const installationExists = await PendingSlackInstallation.findOne({
          folderId: folder._id,
          "options.channelId": channel_id,
          "options.teamId": team_id,
          isComplete: true,
        })
          .lean()
          .exec();
        if (!folder || !installationExists) {
          SlackLib.postToResponseUrl(response_url, {
            text: "No connected folder with this folderPath was found.",
            response_type: "ephemeral",
          });
          break;
        }

        await PendingSlackInstallation.deleteMany({
          folderId: folder._id,
          "options.channelId": channel_id,
          "options.teamId": team_id,
          isComplete: true,
        });

        MyLogtree.sendLog({
          content: `Someone disconnected log forwarding from Logtree to Slack for folderPath ${folder.fullPath}`,
          folderPath: "/slack-disconnect",
          additionalContext: {
            orgId: folder.organizationId,
            folderPath: folder.fullPath,
            folderCreatedWhen: folder.createdAt,
            originallyInstalledWhen: installationExists.createdAt,
          },
        });

        SlackLib.postToResponseUrl(response_url, {
          text: "You've successfully disconnected this Slack channel from the specified Logtree channel.",
          response_type: "ephemeral",
        });

        break;
      }

      default: {
        const message = `${command} is not a valid command.`;
        SlackLib.postToResponseUrl(response_url, {
          text: message,
        });
        break;
      }
    }
    res.send();
  },
};
