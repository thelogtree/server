import {
  FolderDocument,
  OrganizationDocument,
  UserDocument,
} from "logtree-types";
import { Folder } from "src/models/Folder";
import { Logger } from "./logger";
import { Organization } from "src/models/Organization";
import { Rule } from "src/models/Rule";

export const LoggerHelpers = {
  recordSearch: async (
    organization: OrganizationDocument,
    user: UserDocument,
    isFavorites: boolean,
    query: string,
    folderId?: string,
    isSupportTool?: boolean
  ) => {
    let channelName = isFavorites ? "Favorites" : "Global Search";
    if (folderId) {
      const folder = await Folder.findById(folderId, { fullPath: 1 }).exec();
      channelName = folder?.fullPath || "";
    }

    Logger.sendLog(
      `${
        isSupportTool ? "Support tool: " : ""
      }searched for logs with query '${query}'`,
      `/searches/${organization.slug}`,
      user.email
    );
  },
  recordNewUserCreated: async (organizationId: string, email: string) => {
    const organization = await Organization.findById(organizationId, {
      slug: 1,
    }).exec();
    Logger.sendLog(
      `User joined organization: ${organization?.slug}`,
      `/new-user/${organization?.slug}`,
      email
    );
  },
  recordDeletedFolder: async (
    user: UserDocument,
    folderId: string,
    organization: OrganizationDocument
  ) => {
    const folder = await Folder.findById(folderId, { fullPath: 1 }).exec();
    Logger.sendLog(
      `Deleted folder or channel: ${folder?.fullPath}`,
      `/deleted-folder/${organization?.slug}`,
      user.email
    );
  },
  recordNewRule: async (
    user: UserDocument,
    folderId: string,
    organization: OrganizationDocument
  ) => {
    const folder = await Folder.findById(folderId, { fullPath: 1 }).exec();
    Logger.sendLog(
      `User created rule for a channel: ${folder?.fullPath}`,
      `/rules/${organization?.slug}`,
      user.email
    );
  },
  recordDeletedRule: async (
    user: UserDocument,
    ruleId: string,
    organization: OrganizationDocument
  ) => {
    const rule = await Rule.findById(ruleId).populate("folderId");
    const folder = rule?.folderId as FolderDocument;
    Logger.sendLog(
      `User deleted rule for a channel: ${folder?.fullPath}`,
      `/rules/${organization?.slug}`,
      user.email
    );
  },
  recordCheckingChannel: async (
    user: UserDocument,
    organization: OrganizationDocument,
    isFavorites: boolean,
    folderId?: string
  ) => {
    let channelName = isFavorites ? "Favorites" : "Global Search";
    if (folderId) {
      const folder = await Folder.findById(folderId, { fullPath: 1 }).exec();
      channelName = folder?.fullPath || "";
    }

    Logger.sendLog(
      `User checked a channel: ${channelName}`,
      `/fetched-logs/${organization?.slug}`,
      user.email
    );
  },
};
