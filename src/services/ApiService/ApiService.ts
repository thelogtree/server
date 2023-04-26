import { OrganizationDocument } from "logtree-types";
import { FolderService } from "./lib/FolderService";
import { LogService, SimplifiedLog } from "./lib/LogService";
import { UsageService } from "./lib/UsageService";
import { Folder } from "src/models/Folder";
import { ApiError } from "src/utils/errors";
import { Log } from "src/models/Log";

export const ApiService = {
  createLog: async (
    organization: OrganizationDocument,
    folderPath: string,
    content: string,
    referenceId?: string,
    externalLink?: string,
    shouldCharge: boolean = false
  ) => {
    FolderService.validateFolderPath(folderPath);
    const folderIdForThisLog =
      await FolderService.getOrGenerateLastFolderIdFromPath(
        organization._id.toString(),
        folderPath
      );
    const log = await LogService.createLog(
      organization._id.toString(),
      folderIdForThisLog,
      content,
      referenceId,
      externalLink
    );
    await Folder.updateOne(
      { _id: folderIdForThisLog },
      { dateOfMostRecentLog: new Date() }
    );
    if (shouldCharge) {
      await UsageService.recordNewLog(organization);
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
};
