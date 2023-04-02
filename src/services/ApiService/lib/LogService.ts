import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { Log } from "src/models/Log";
import { FolderService } from "./FolderService";
import { UserDocument } from "logtree-types";

export const MAX_NUM_CHARS_ALLOWED_IN_LOG = 1000;

export type SimplifiedLog = {
  _id: ObjectId | string;
  content: string;
  createdAt: Date;
  folderId?: ObjectId | string;
  referenceId?: string;
};

export const LogService = {
  createLog: (
    organizationId: string,
    folderId: string,
    content: string,
    referenceId?: string
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

    return Log.find(
      {
        ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
        createdAt: {
          $lt: logsNoNewerThanDate,
          ...(logsNoOlderThanDate && { $gt: logsNoOlderThanDate }),
        },
      },
      {
        content: 1,
        _id: 1,
        ...(user ? { folderId: 1 } : {}),
        referenceId: 1,
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
    return Log.find({
      ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
      createdAt: {
        $lt: logsNoNewerThanDate,
        ...(logsNoOlderThanDate && { $gt: logsNoOlderThanDate }),
      },
    })
      .lean()
      .countDocuments()
      .exec();
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
        ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
        ...(isReferenceId
          ? { referenceId }
          : { content: { $regex: `.*${query}.*`, $options: "i" } }),
        createdAt: { $gt: DateTime.now().minus({ days: 14 }) },
      },
      { content: 1, _id: 1, referenceId: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
      .exec() as Promise<SimplifiedLog[]>;
  },
};
