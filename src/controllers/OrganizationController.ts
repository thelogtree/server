import { Request, Response } from "express";
import { OrganizationDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { Log } from "src/models/Log";
import { FolderService } from "src/services/ApiService/lib/FolderService";
import { LogService } from "src/services/ApiService/lib/LogService";
import { OrganizationService } from "src/services/OrganizationService";
import { Logger } from "src/utils/logger";

export const OrganizationController = {
  getMe: async (req: Request, res: Response) => {
    const user = req["user"];
    res.send(user);
  },
  getOrganization: async (req: Request, res: Response) => {
    const organization = req["organization"];
    await Logger.sendLog(
      "fetched org " + organization.name,
      "/organization-fetches"
    );
    res.send(organization);
  },
  getFolders: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const folders = await FolderService.getFolders(organization._id);
    res.send({ folders });
  },
  getLogs: async (req: Request, res: Response) => {
    const { folderId, start, logsNoNewerThanDate } = req.query;
    const backupDate = new Date();
    const logs = await LogService.getLogs(
      folderId as string,
      Number(start || 0),
      undefined,
      (logsNoNewerThanDate as Date | undefined) || backupDate
    );
    const numLogsInTotal = await LogService.getNumLogsInFolder(
      folderId as string,
      (logsNoNewerThanDate as Date | undefined) || backupDate
    );
    res.send({ logs, numLogsInTotal });
  },
  searchForLogs: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const { folderId, query } = req.body;
    const logs = await LogService.searchForLogs(
      organization._id,
      folderId as string,
      query as string
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
};
