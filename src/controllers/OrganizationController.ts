import { Request, Response } from "express";
import { OrganizationDocument, UserDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { FolderService } from "src/services/ApiService/lib/FolderService";
import { LogService } from "src/services/ApiService/lib/LogService";
import { OrganizationService } from "src/services/OrganizationService";
import { ApiError } from "src/utils/errors";
import { queryBool } from "src/utils/helpers";
import { Logger } from "src/utils/logger";

export const OrganizationController = {
  getMe: async (req: Request, res: Response) => {
    const user = req["user"];
    res.send(user);
  },
  getOrganization: async (req: Request, res: Response) => {
    const organization = req["organization"];
    res.send(organization);
  },
  getOrganizationMembers: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const users = await OrganizationService.getOrganizationMembers(
      organization._id
    );
    res.send({ users });
  },
  getFolders: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const user = req["user"];
    const folders = await FolderService.getFolders(organization._id, user._id);
    res.send({ folders });
  },
  getLogs: async (req: Request, res: Response) => {
    const user = req["user"];
    const { folderId, start, isFavorites, logsNoNewerThanDate } = req.query;
    const backupDate = new Date();
    const isFavoritesBool = queryBool(isFavorites as string);
    if (!folderId && !isFavoritesBool) {
      throw new ApiError("Must provide either a folderId or isFavorites");
    }

    const [logs, numLogsInTotal] = await Promise.all([
      LogService.getLogs(
        folderId as string | undefined,
        isFavoritesBool ? user : undefined,
        Number(start || 0),
        undefined,
        (logsNoNewerThanDate as Date | undefined) || backupDate
      ),
      LogService.getNumLogsInFolder(
        (logsNoNewerThanDate as Date | undefined) || backupDate,
        folderId as string | undefined,
        isFavoritesBool ? user : undefined
      ),
    ]);

    await FolderService.recordUserCheckingFolder(
      user._id,
      folderId as string,
      isFavoritesBool
    );

    res.send({ logs, numLogsInTotal });
  },
  searchForLogs: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const user = req["user"];
    const { folderId, isFavorites, query } = req.body;
    if (!folderId && !queryBool(isFavorites as string)) {
      throw new ApiError("Must provide either a folderId or isFavorites");
    }
    const logs = await LogService.searchForLogs(
      organization._id,
      query as string,
      folderId as string | undefined,
      queryBool(isFavorites as string) ? user : undefined
    );
    Logger.sendLog(
      `searched for logs with query '${query}'`,
      `/searches/${organization.slug}`
    );
    res.send({ logs });
  },
  createOrganization: async (req: Request, res: Response) => {
    const { name } = req.body;
    const { organization, firstInvitationUrl } =
      await OrganizationService.createOrganization(name);
    res.send({ organization, firstInvitationUrl });
  },
  generateSecretKey: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const plaintextSecretKey = await OrganizationService.generateSecretKey(
      organization._id
    );
    res.send({ plaintextSecretKey });
  },
  generateInviteLink: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const url = await OrganizationService.generateInviteLink(
      organization._id as unknown as ObjectId,
      organization.slug
    );
    res.send({ url });
  },
  createNewUser: async (req: Request, res: Response) => {
    const organizationId = req.params.id;
    const { invitationId, email, password } = req.body;
    const user = await OrganizationService.createNewUser(
      organizationId,
      invitationId,
      email,
      password
    );
    res.send(user);
  },
  getInvitationInfo: async (req: Request, res: Response) => {
    const { invitationId, orgSlug } = req.query;
    const { organizationName, numMembers, organizationId } =
      await OrganizationService.getInvitationInfo(
        orgSlug as string,
        invitationId as string
      );
    res.send({ organizationName, numMembers, organizationId });
  },
  deleteFolderAndEverythingInside: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const { folderId } = req.body;
    await OrganizationService.deleteFolderAndEverythingInside(
      organization._id.toString(),
      folderId
    );
    res.send({});
  },
  updateUserPermissions: async (req: Request, res: Response) => {
    const organization: OrganizationDocument = req["organization"];
    const user: UserDocument = req["user"];
    const { newPermission, isRemoved, userIdToUpdate } = req.body;
    await OrganizationService.updateUserPermissions(
      organization._id.toString(),
      user._id.toString(),
      userIdToUpdate,
      newPermission,
      isRemoved
    );
    res.send({});
  },
  favoriteFolder: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const { fullPath, isRemoved } = req.body;
    await OrganizationService.favoriteFolder(
      user?._id.toString(),
      fullPath,
      isRemoved
    );
    res.send({});
  },
  getFavoriteFolderPaths: async (req: Request, res: Response) => {
    const user: UserDocument = req["user"];
    const folderPaths = await OrganizationService.getFavoriteFolderPaths(
      user?._id.toString()
    );
    res.send({ folderPaths });
  },
};
