import { ObjectId } from "mongodb";
import { Log } from "src/models/Log";
import { FolderService } from "./FolderService";
import {
  OrganizationDocument,
  UserDocument,
  integrationTypeEnum,
  simplifiedLogTagEnum,
} from "logtree-types";
import { ApiError, AuthError } from "src/utils/errors";
import { SecureIntegrationService } from "src/services/integrations/index";
import moment from "moment";
import { Integration } from "src/models/Integration";
import { queryBool } from "src/utils/helpers";

export const MAX_NUM_CHARS_ALLOWED_IN_LOG = 1500;

export type SimplifiedLog = {
  _id: ObjectId | string;
  content: string;
  createdAt: Date;
  folderId?: ObjectId | string;
  referenceId?: string;
  externalLink?: string;
  tag?: simplifiedLogTagEnum;
  sourceType?: integrationTypeEnum;
  additionalContext?: Map<any, any>;
};

export const LogService = {
  createLog: (
    organizationId: string,
    folderId: string,
    content: string,
    referenceId?: string,
    externalLink?: string,
    additionalContext?: Map<any, any>
  ) => {
    let editedContent = content;
    if (content.length > MAX_NUM_CHARS_ALLOWED_IN_LOG) {
      editedContent =
        content.substring(0, MAX_NUM_CHARS_ALLOWED_IN_LOG) + "...";
    }

    if (additionalContext && JSON.stringify(additionalContext).length > 2500) {
      additionalContext = new Map();
    }

    return Log.create({
      content: editedContent,
      organizationId,
      folderId,
      referenceId,
      externalLink,
      additionalContext,
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
        ...(logsNoNewerThanDate || logsNoOlderThanDate
          ? {
              createdAt: {
                ...(logsNoNewerThanDate && { $lte: logsNoNewerThanDate }),
                ...(logsNoOlderThanDate && { $gt: logsNoOlderThanDate }),
              },
            }
          : {}),
      },
      {
        content: 1,
        _id: 1,
        ...(user ? { folderId: 1 } : {}),
        referenceId: 1,
        externalLink: 1,
        additionalContext: 1,
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

    const isContextFilter = query.indexOf("context.") === 0; // must include context. in the beginning to query for a tag in the context
    let tags: { key: string; value: string | number | boolean }[] = [];
    if (isContextFilter) {
      query.split("&").forEach((individualTagStr) => {
        individualTagStr = individualTagStr.slice(8);
        const indexOfTagValue = individualTagStr.indexOf("=") + 1;
        let tagKey = individualTagStr.slice(0, indexOfTagValue - 1);
        let tagValue: string | number | boolean =
          individualTagStr.slice(indexOfTagValue);
        if (tagValue[0] === '"') {
          // it's a string
          tagValue = tagValue.slice(1, tagValue.length - 1);
        } else {
          // not a string
          if (isNaN(Number(tagValue))) {
            // assume it is a boolean
            tagValue = queryBool(tagValue);
          } else {
            // assume it is a number
            tagValue = Number(tagValue);
          }
        }
        tags.push({
          key: tagKey,
          value: tagValue,
        });
      });
    }
    const isValidContextSearch =
      isContextFilter &&
      tags.length &&
      !tags.find((tag) => !tag.key.length || typeof tag.value === "undefined");
    const hydratedTags = tags.map((tag) => ({
      key: "additionalContext." + tag.key,
      value: tag.value,
    }));

    return Log.find(
      {
        organizationId,
        ...(user && { folderId: { $in: favoritedFolderIds } }),
        ...(folderId && { folderId }),
        ...(isReferenceId ? { referenceId } : {}),
        ...(isValidContextSearch
          ? hydratedTags.reduce((acc, tag) => {
              return {
                ...acc,
                [`${tag.key}`]: { $eq: tag.value },
              };
            }, {})
          : {}),
        ...(!isReferenceId && !isValidContextSearch
          ? {
              content: { $regex: `.*${query}.*`, $options: "i" },
            }
          : {}),
      },
      {
        content: 1,
        _id: 1,
        referenceId: 1,
        createdAt: 1,
        folderId: 1,
        externalLink: 1,
        additionalContext: 1,
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
  getSupportLogs: async (organization: OrganizationDocument, query: string) => {
    const [logs, integrationLogs] = await Promise.all([
      Log.find(
        {
          organizationId: organization._id,
          referenceId: query,
        },
        {
          content: 1,
          _id: 1,
          referenceId: 1,
          createdAt: 1,
          folderId: 1,
          externalLink: 1,
          additionalContext: 1,
        }
      )
        .sort({ createdAt: -1 })
        .limit(400)
        .lean()
        .exec() as Promise<SimplifiedLog[]>,
      SecureIntegrationService.getLogsFromIntegrations(organization, query),
    ]);

    const combinedLogs = logs.concat(integrationLogs);
    const sortedLogs = combinedLogs.sort((a, b) =>
      moment(a["createdAt"]).isAfter(moment(b["createdAt"])) ? -1 : 1
    );

    return sortedLogs.slice(0, 400);
  },
  getIntegrationLogs: async (
    organization: OrganizationDocument,
    integrationId: string,
    query?: string
  ) => {
    const integration = await Integration.findOne({
      organizationId: organization._id,
      _id: integrationId,
    }).exec();
    if (!integration) {
      throw new ApiError("Could not find an integration with this ID.");
    }

    let getLogsFunction =
      SecureIntegrationService.getCorrectLogsFunctionToRun(integration);
    const logs = await getLogsFunction!(organization, integration, query);

    const sortedLogs = logs.sort((a, b) =>
      moment(a["createdAt"]).isAfter(moment(b["createdAt"])) ? -1 : 1
    );

    return sortedLogs.slice(0, 400);
  },
};
