import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { Log } from "src/models/Log";

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
  getLogs: (
    folderId: string | ObjectId,
    start: number = 0,
    maxLogsToRetrieve: number = 100,
    logsNoNewerThanDate?: Date
  ): Promise<SimplifiedLog[]> =>
    Log.find(
      {
        folderId,
        createdAt: { $lt: logsNoNewerThanDate },
      },
      { content: 1, _id: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .skip(start)
      .limit(maxLogsToRetrieve)
      .lean()
      .exec() as Promise<SimplifiedLog[]>,
  getNumLogsInFolder: (folderId: string, logsNoNewerThanDate?: Date) =>
    Log.find({ folderId, createdAt: { $lt: logsNoNewerThanDate } })
      .lean()
      .countDocuments()
      .exec(),
  searchForLogs: async (
    organizationId: string | ObjectId,
    folderId: string | ObjectId,
    query: string
  ): Promise<SimplifiedLog[]> =>
    Log.find(
      {
        organizationId,
        folderId,
        content: { $regex: `.*${query}.*`, $options: "i" },
        createdAt: { $gt: DateTime.now().minus({ days: 14 }) },
      },
      { content: 1, _id: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
      .exec() as Promise<SimplifiedLog[]>,
};
