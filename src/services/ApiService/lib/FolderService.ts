import _ from "lodash";
import {
  FolderDocument,
  FolderPreferenceDocument,
  LastCheckedFolderDocument,
  UserDocument,
} from "logtree-types";
import moment from "moment";
import { ObjectId } from "mongodb";
import { FavoriteFolder } from "src/models/FavoriteFolder";
import { Folder } from "src/models/Folder";
import { FolderPreference } from "src/models/FolderPreference";
import { LastCheckedFolder } from "src/models/LastCheckedFolder";
import { Log } from "src/models/Log";
import { User } from "src/models/User";
import { ApiError } from "src/utils/errors";

type TreeRepresentation = {
  _id: string | ObjectId;
  name: string;
  fullPath: string;
  hasUnreadLogs: boolean;
  isMuted: boolean;
  children: TreeRepresentation[];
};

export const FolderService = {
  validateFolderPath: (folderPath: string) => {
    if (folderPath[0] !== "/") {
      throw new ApiError("Your folderPath must begin with a /");
    }
    if (folderPath.includes(" ")) {
      throw new ApiError("Your folderPath cannot include any spaces.");
    }
    if (folderPath.length <= 1) {
      throw new ApiError(
        "Please provide a valid folderPath string (e.g. /transactions)."
      );
    }
  },
  buildFolderTree(
    allFolders: (FolderDocument & any)[],
    parentFolderId: string | null,
    lastCheckedFolders: LastCheckedFolderDocument[],
    folderPreferences: FolderPreferenceDocument[],
    userId: string | ObjectId
  ): TreeRepresentation[] {
    let tree: any[] = [];
    for (let folder of allFolders) {
      if (folder.parentFolderId?.toString() === parentFolderId?.toString()) {
        let children = FolderService.buildFolderTree(
          allFolders,
          folder._id.toString(),
          lastCheckedFolders,
          folderPreferences,
          userId
        );
        if (children.length) {
          folder.children = children;
        } else {
          folder.children = [];
        }

        const hasUnreadLogs = FolderService.getDoesFolderHaveUnreadLogs(
          lastCheckedFolders,
          folder
        );
        folder.hasUnreadLogs = hasUnreadLogs;

        const isMuted = FolderService.getIsFolderMuted(
          folderPreferences,
          folder
        );
        folder.isMuted = isMuted;

        tree.push(
          _.pick(folder, [
            "_id",
            "name",
            "fullPath",
            "children",
            "description",
            "hasUnreadLogs",
            "isMuted",
          ])
        );
      }
    }
    return tree;
  },
  getFolders: async (
    organizationId: ObjectId,
    userId: ObjectId
  ): Promise<TreeRepresentation[]> => {
    // returns a matrix-like representation of the folders for this organization
    const [allFoldersInOrg, lastCheckedFolders, folderPreferences] =
      await Promise.all([
        Folder.find({ organizationId }).sort({ createdAt: 1 }).lean().exec(),
        LastCheckedFolder.find({ userId })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        FolderPreference.find({ userId }).sort({ createdAt: -1 }).lean().exec(),
      ]);

    return FolderService.buildFolderTree(
      allFoldersInOrg,
      null,
      lastCheckedFolders,
      folderPreferences,
      userId
    );
  },
  findOrCreateNewFolderId: async (
    organizationId: string,
    parentFolderId: string | null,
    name: string,
    fullPath: string
  ): Promise<string> => {
    const existingFolder = await Folder.findOne({
      organizationId,
      name,
      parentFolderId,
    })
      .lean()
      .exec();

    if (existingFolder) {
      return existingFolder._id.toString();
    }

    const newFolder = await Folder.create({
      name,
      organizationId,
      parentFolderId,
      fullPath,
    });

    return newFolder._id.toString();
  },
  getOrGenerateLastFolderIdFromPath: async (
    organizationId: string,
    folderPath: string
  ): Promise<string> => {
    const splitPaths = folderPath.split("/");
    const lastPath = _.last(splitPaths);

    // build or fetch the folder path that was specified
    let lastFolderId: string | null = null;
    let pathSoFar = "";
    for (const path of splitPaths) {
      if (!path) {
        continue;
      }
      pathSoFar += `/${path}`;
      lastFolderId = await FolderService.findOrCreateNewFolderId(
        organizationId,
        lastFolderId,
        path,
        pathSoFar
      );

      // make sure we aren't opening up new subfolders inside folders that already have a log in them
      // (i.e. a folder cannot have both logs and subfolder(s). it can only have one of those.)
      if (lastPath !== path) {
        const existingLogInFolder = await Log.exists({
          folderId: lastFolderId,
        });
        if (existingLogInFolder) {
          throw new ApiError(
            "You cannot create subfolders inside of a folder that already has at least 1 log."
          );
        }
      }
    }

    if (!lastFolderId) {
      throw new ApiError("Something went wrong when parsing the folder path.");
    }

    return lastFolderId;
  },
  getFavoritedFolderIds: async (user: UserDocument): Promise<string[]> => {
    const favoritedFolders = await FavoriteFolder.find(
      { userId: user._id },
      { fullPath: 1 }
    )
      .lean()
      .exec();
    const folders = await Folder.find(
      {
        organizationId: user.organizationId,
      },
      { _id: 1, fullPath: 1 }
    )
      .lean()
      .exec();
    const filteredFolders = folders.filter(
      (orgFolder) =>
        !!favoritedFolders.find(
          (favorited) => orgFolder.fullPath.indexOf(favorited.fullPath) === 0
        )
    );
    return filteredFolders.map((f) => f._id.toString());
  },
  recordUserCheckingFolder: async (
    userId: string | ObjectId,
    folderId?: string | ObjectId,
    isFavorites: boolean = false
  ) => {
    let fullPath = "";
    if (folderId) {
      const folder = await Folder.findById(folderId, { fullPath: 1, _id: 0 });
      if (!folder) {
        return;
      }
      fullPath = folder.fullPath;
    }

    if (isFavorites || folderId) {
      if (folderId) {
        await LastCheckedFolder.create({ userId, fullPath });
      } else {
        // don't await this call because speed is unimportant in this case
        LastCheckedFolder.create({ userId, fullPath });
      }

      if (isFavorites) {
        // if we are checking the favorites folder, label that we checked
        // all of the channels that are favorited.
        const favoritedFolders = await FavoriteFolder.find(
          { userId },
          { fullPath: 1 }
        )
          .lean()
          .exec();
        await Promise.all(
          favoritedFolders.map((folder) =>
            LastCheckedFolder.create({ userId, fullPath: folder.fullPath })
          )
        );
      }
    }
  },
  getDoesFolderHaveUnreadLogs: (
    lastCheckedFoldersForUser: LastCheckedFolderDocument[], // should already be in descending date order (so the newest document is at index 0)
    folder: FolderDocument
  ) => {
    const lastCheckedThisFolder = lastCheckedFoldersForUser.find(
      (lastCheckedFolder) => lastCheckedFolder.fullPath === folder.fullPath
    );
    if (!lastCheckedThisFolder) {
      return true;
    }

    const dateLastCheckedFolder = lastCheckedThisFolder.createdAt;
    const dateOfLastLogInFolder = folder.dateOfMostRecentLog;

    return (
      !!dateOfLastLogInFolder &&
      moment(dateOfLastLogInFolder).isAfter(moment(dateLastCheckedFolder))
    );
  },
  getIsFolderMuted: (
    folderPreferences: FolderPreferenceDocument[],
    folder: FolderDocument
  ) => {
    const folderPreferenceForThisFolder = folderPreferences.find(
      (folderPreference) => folderPreference.fullPath === folder.fullPath
    );

    return !!folderPreferenceForThisFolder?.isMuted;
  },
  updateFolder: async (
    organizationId: string,
    folderId: string,
    description?: string
  ) => {
    const folder = await Folder.exists({
      organizationId,
      _id: folderId,
    }).exec();
    if (!folder) {
      throw new ApiError("Cannot update a folder that doesn't exist.");
    }

    return Folder.findByIdAndUpdate(folderId, { description }, { new: true });
  },
};
