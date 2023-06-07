import {
  FolderDocument,
  OrganizationDocument,
  UserDocument,
} from "logtree-types";
import { Folder } from "src/models/Folder";
import { MyLogtree } from "./logger";
import { Organization } from "src/models/Organization";
import { Rule } from "src/models/Rule";
import { Request } from "express";

export const LoggerHelpers = {
  recordSearch: async (
    req: Request,
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

    MyLogtree.sendLog({
      content: `${
        isSupportTool ? "Support tool: " : ""
      }searched for logs with query '${query}'`,
      folderPath: `/searches/${organization.slug}`,
      referenceId: user.email,
      req,
    });
  },
  recordNewUserCreated: async (
    req: Request,
    organizationId: string,
    email: string
  ) => {
    const organization = await Organization.findById(organizationId, {
      slug: 1,
    }).exec();
    MyLogtree.sendLog({
      content: `User joined organization: ${organization?.slug}`,
      folderPath: `/new-user/${organization?.slug}`,
      referenceId: email,
    });
  },
  recordDeletedFolder: async (
    req: Request,
    user: UserDocument,
    folderId: string,
    organization: OrganizationDocument
  ) => {
    const folder = await Folder.findById(folderId, { fullPath: 1 }).exec();
    MyLogtree.sendLog({
      content: `Deleted folder or channel: ${folder?.fullPath}`,
      folderPath: `/deleted-folder/${organization?.slug}`,
      referenceId: user.email,
      req,
    });
  },
  recordNewRule: async (
    req: Request,
    user: UserDocument,
    folderId: string,
    organization: OrganizationDocument
  ) => {
    const folder = await Folder.findById(folderId, { fullPath: 1 }).exec();
    MyLogtree.sendLog({
      content: `User created rule for a channel: ${folder?.fullPath}`,
      folderPath: `/rules/${organization?.slug}`,
      referenceId: user.email,
      req,
    });
  },
  recordDeletedRule: async (
    req: Request,
    user: UserDocument,
    organization: OrganizationDocument,
    folderPath?: string
  ) =>
    MyLogtree.sendLog({
      content: `User deleted rule from channel: ${folderPath}`,
      folderPath: `/rules/${organization?.slug}`,
      referenceId: user.email,
      req,
    }),
  recordCheckingChannel: async (
    req: Request,
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

    MyLogtree.sendLog({
      content: `User checked a channel: ${channelName}`,
      folderPath: `/fetched-logs/${organization?.slug}`,
      referenceId: user.email,
      req,
    });
  },
  recordCreatedFunnel: async (
    req: Request,
    user: UserDocument,
    organization: OrganizationDocument,
    forwardLogsToChannel: string,
    channelsForwardingFrom: string
  ) =>
    MyLogtree.sendLog({
      content: `Created funnel to go to: ${forwardLogsToChannel}`,
      folderPath: `/funnels/${organization?.slug}`,
      referenceId: user.email,
      req,
      additionalContext: {
        folderPathsInFunnel: channelsForwardingFrom,
      },
    }),
};
