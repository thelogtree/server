import { Request, Response } from 'express';
import moment from 'moment';
import { Folder } from 'src/models/Folder';
import { PendingSlackInstallation } from 'src/models/PendingSlackInstallation';
import { config } from 'src/utils/config';
import { slackInstaller, SlackLib } from 'src/utils/Slack';

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
    const { text, channel_id, team_id, response_url } = req.body;

    // parse slash command
    const parsedText = text.split(" ");
    const command = parsedText[0];
    const value = parsedText[1];

    switch (command) {
      case "subscribe": {
        if (!value) {
          SlackLib.postToResponseUrl(response_url, {
            text: "Please provide your one-time installation code.",
            response_type: "ephemeral",
          });
          break;
        }

        const weekOld = moment().subtract(7, "days").toDate();
        const pendingInstallation = await PendingSlackInstallation.findOne({
          _id: value,
          createdAt: { $gte: weekOld },
        })
          .lean()
          .exec();
        if (!pendingInstallation) {
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

        SlackLib.postToResponseUrl(response_url, {
          text: "You've successfully connected a Logtree channel to this Slack channel! We'll start forwarding future logs automatically.",
          response_type: "ephemeral",
        });
        break;
      }

      case "unsubscribe": {
        if (!value) {
          SlackLib.postToResponseUrl(response_url, {
            text: "Please provide the folderPath you would like to unsubscribe from.",
            response_type: "ephemeral",
          });
          break;
        }

        const folder = await Folder.findOne({ folderPath: value })
          .lean()
          .exec();
        await PendingSlackInstallation.deleteMany({
          folderId: folder._id,
          "options.channelId": channel_id,
          "options.teamId": team_id,
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
