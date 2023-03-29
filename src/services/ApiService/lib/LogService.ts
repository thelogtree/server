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
};

export const LogService = {
  createLog: (organizationId: string, folderId: string, content: string) => {
    let editedContent = content;
    if (content.length > MAX_NUM_CHARS_ALLOWED_IN_LOG) {
      editedContent =
        content.substring(0, MAX_NUM_CHARS_ALLOWED_IN_LOG) + "...";
    }

    return Log.create({
      content: editedContent,
      organizationId,
      folderId,
    });
  },
  getLogs: async (
    folderId?: string | ObjectId,
    user?: UserDocument,
    start: number = 0,
    maxLogsToRetrieve: number = 100,
    logsNoNewerThanDate?: Date
  ): Promise<SimplifiedLog[]> => {
    // we assume the response should be the user's favorited logs if user param is provided
    let favoritedFolderIds: string[] = [];
    if (user) {
      favoritedFolderIds = await FolderService.getFavoritedFolderIds(user);
    }

    return Log.find(
      {
        ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
        createdAt: { $lt: logsNoNewerThanDate },
      },
      { content: 1, _id: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .skip(start)
      .limit(maxLogsToRetrieve)
      .lean()
      .exec() as Promise<SimplifiedLog[]>;
  },
  getNumLogsInFolder: async (
    logsNoNewerThanDate?: Date,
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
      createdAt: { $lt: logsNoNewerThanDate },
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

    return Log.find(
      {
        organizationId,
        ...(user ? { folderId: { $in: favoritedFolderIds } } : { folderId }),
        content: { $regex: `.*${query}.*`, $options: "i" },
        createdAt: { $gt: DateTime.now().minus({ days: 14 }) },
      },
      { content: 1, _id: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
      .exec() as Promise<SimplifiedLog[]>;
  },
};
