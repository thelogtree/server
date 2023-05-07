import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { Log } from "src/models/Log";
import { FolderService } from "./FolderService";
import { UserDocument, simplifiedLogTagEnum } from "logtree-types";
import { ApiError, AuthError } from "src/utils/errors";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import moment from "moment";

export const MAX_NUM_CHARS_ALLOWED_IN_LOG = 1000;

export type SimplifiedLog = {
  _id: ObjectId | string;
  content: string;
  createdAt: Date;
  folderId?: ObjectId | string;
  referenceId?: string;
  externalLink?: string;
  tag?: simplifiedLogTagEnum;
};

export const LogService = {
  createLog: (
    organizationId: string,
    folderId: string,
    content: string,
    referenceId?: string,
    externalLink?: string
  ) => {
    let editedContent = content;
    if (content.length > MAX_NUM_CHARS_ALLOWED_IN_LOG) {
      editedContent =
        content.substring(0, MAX_NUM_CHARS_ALLOWED_IN_LOG) + "...";
    }

    return Log.create({
      content: editedContent,
      organizationId,
      folderId,
      referenceId,
      externalLink,
    });
  },
  getLogs: async (
    folderId?: string | ObjectId,
    user?: UserDocument,
    start: number = 0,
    maxLogsToRetrieve: number = 50,
    logsNoNewerThanDate?: Date,
    logsNoOlderThanDate?: Date
  ): Promise<SimplifiedLog[]> => {
    // we assume the response should be the user's favorited logs if user param is provided
    let favoritedFolderIds: string[] = [];
    if (user) {
      favoritedFolderIds = await FolderService.getFavoritedFolderIds(user);
    }

    if (!user && !folderId) {
      throw new ApiError(
        "Must provide either a folderId or specify that you are looking for Favorites."
      );
    }

    return Log.find(
      {
        ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
        createdAt: {
          $lte: logsNoNewerThanDate,
          ...(logsNoOlderThanDate && { $gt: logsNoOlderThanDate }),
        },
      },
      {
        content: 1,
        _id: 1,
        ...(user ? { folderId: 1 } : {}),
        referenceId: 1,
        externalLink: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .skip(start)
      .limit(maxLogsToRetrieve)
      .lean()
      .exec() as Promise<SimplifiedLog[]>;
  },
  getNumLogsInFolder: async (
    logsNoNewerThanDate?: Date,
    logsNoOlderThanDate?: Date,
    folderId?: string,
    user?: UserDocument
  ) => {
    // we assume the response should be the user's favorited logs if user param is provided
    let favoritedFolderIds: string[] = [];
    if (user) {
      favoritedFolderIds = await FolderService.getFavoritedFolderIds(user);
    }

    if (!user && !folderId) {
      throw new ApiError(
        "Must provide either a folderId or specify that you are looking for Favorites."
      );
    }

    return Log.countDocuments({
      ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
      createdAt: {
        $lte: logsNoNewerThanDate,
        ...(logsNoOlderThanDate && { $gt: logsNoOlderThanDate }),
      },
    }).exec();
  },
  searchForLogs: async (
    organizationId: string | ObjectId,
    query: string,
    folderId?: string | ObjectId,
    user?: UserDocument
  ): Promise<SimplifiedLog[]> => {
    // we assume the response should be the user's favorited logs if user param is provided
    let favoritedFolderIds: string[] = [];
    if (user) {
      favoritedFolderIds = await FolderService.getFavoritedFolderIds(user);
    }

    const isReferenceId = query.indexOf("id:") === 0; // must include id: in the beginning to query for a referenceId
    let referenceId;
    if (isReferenceId) {
      referenceId = query.slice(3);
    }

    return Log.find(
      {
        organizationId,
        ...(user && { folderId: { $in: favoritedFolderIds } }),
        ...(folderId && { folderId }),
        ...(isReferenceId
          ? { referenceId }
          : { content: { $regex: `.*${query}.*`, $options: "i" } }),
      },
      {
        content: 1,
        _id: 1,
        referenceId: 1,
        createdAt: 1,
        folderId: 1,
        externalLink: 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
      .exec() as Promise<SimplifiedLog[]>;
  },
  deleteLog: async (logId: string, organizationId: string) => {
    const log = await Log.findById(logId, { organizationId: 1 }).exec();
    if (!log || log?.organizationId.toString() !== organizationId.toString()) {
      throw new AuthError("Cannot delete a log from a different organization.");
    }

    await Log.deleteOne({ _id: logId });
  },
  getSupportLogs: async (organizationId: string, query: string) => {
    const [logs, integrationLogs] = await Promise.all([
      Log.find(
        {
          organizationId,
          referenceId: query,
        },
        {
          content: 1,
          _id: 1,
          referenceId: 1,
          createdAt: 1,
          folderId: 1,
          externalLink: 1,
        }
      )
        .sort({ createdAt: -1 })
        .limit(300)
        .lean()
        .exec() as Promise<SimplifiedLog[]>,
      SecureIntegrationService.getLogsFromIntegrations(organizationId, query),
    ]);

    const combinedLogs = logs.concat(integrationLogs);
    const sortedLogs = combinedLogs.sort((a, b) =>
      moment(a["createdAt"]).isAfter(moment(b["createdAt"])) ? -1 : 1
    );

    return sortedLogs;
  },
};
