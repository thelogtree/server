import { ApiError } from "src/utils/errors";
import _ from "lodash";
import { OrganizationDocument } from "logtree-types";
import { Folder } from "src/models/Folder";

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
  findOrCreateNewFolderId: async (
    organizationId: string,
    parentFolderId: string | null,
    name: string
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
    });

    return newFolder._id.toString();
  },
  getOrGenerateLastFolderIdFromPath: async (
    organizationId: string,
    folderPath: string
  ): Promise<string> => {
    const splitPaths = folderPath.split("/");

    // build or fetch the folder path that was specified
    let lastFolderId: string | null = null;
    for (const path of splitPaths) {
      if (!path) {
        continue;
      }
      lastFolderId = await FolderService.findOrCreateNewFolderId(
        organizationId,
        lastFolderId,
        path
      );
    }

    if (!lastFolderId) {
      throw new ApiError("Something went wrong when parsing the folder path.");
    }

    return lastFolderId;
  },
};
