import { OrganizationDocument } from 'logtree-types';
import { Folder } from 'src/models/Folder';
import { Log } from 'src/models/Log';
import { RouteMonitor } from 'src/models/RouteMonitor';
import { ApiError } from 'src/utils/errors';
import { SlackLib } from 'src/utils/Slack';

import { OrganizationService } from '../OrganizationService';
import { FolderService } from './lib/FolderService';
import { LogService, SimplifiedLog } from './lib/LogService';
import { UsageService } from './lib/UsageService';

export const ApiService = {
  createLog: async (
    organization: OrganizationDocument,
    folderPath: string,
    content: string,
    referenceId?: string,
    externalLink?: string,
    additionalContext?: Map<any, any>,
    shouldCharge: boolean = false
  ) => {
    FolderService.validateFolderPath(folderPath);
    const folderIdForThisLog =
      await FolderService.getOrGenerateLastFolderIdFromPath(
        organization._id.toString(),
        folderPath
      );

    // make sure we don't overflow the context and make a massive mongo document
    if (additionalContext && JSON.stringify(additionalContext).length > 2200) {
      additionalContext = new Map();
      additionalContext["logtree_message"] =
        "context was not recorded because it was too long.";
    }

    const log = await LogService.createLog(
      organization._id.toString(),
      folderIdForThisLog,
      content,
      referenceId,
      externalLink,
      additionalContext
    );
    await Folder.updateOne(
      { _id: folderIdForThisLog },
      { dateOfMostRecentLog: new Date() }
    );

    void SlackLib.postToSlackIntegrationIfExists(log, organization, folderPath);

    if (shouldCharge) {
      await UsageService.recordNewLog(organization);
    }

    // must be called after the log is created
    if (referenceId) {
      void OrganizationService.evaluateFunnels(
        organization,
        folderPath,
        referenceId
      );
    }

    return log;
  },
  getLogs: async (
    organization: OrganizationDocument,
    folderPath?: string,
    referenceId?: string
  ) => {
    let folderId;
    if (folderPath) {
      const folder = await Folder.findOne(
        { fullPath: folderPath, organizationId: organization._id },
        { _id: 1 }
      ).exec();
      if (!folder) {
        throw new ApiError("No folder with this folderPath was found.");
      }
      folderId = folder._id;
    }

    const logs = (await Log.find(
      {
        ...(folderId && { folderId }),
        ...(referenceId && { referenceId }),
        organizationId: organization._id,
      },
      {
        _id: 1,
        content: 1,
        folderId: 1,
        referenceId: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec()) as SimplifiedLog[];

    return logs.map((log) => ({
      ...log,
      id: log._id.toString(),
    }));
  },
  // tracking a call for route monitors
  recordCall: async (
    organizationId: string,
    path: string,
    errorCode?: string
  ) =>
    RouteMonitor.updateOne(
      { organizationId, path },
      {
        $inc: {
          ...(errorCode ? { [`errorCodes.${errorCode}`]: 1 } : { numCalls: 1 }),
        },
        $setOnInsert: {
          organizationId,
          path
        },
      },
      { upsert: true }
    ),
};
