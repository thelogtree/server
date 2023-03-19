import { Request, Response } from "express";
import { OrganizationDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { FolderService } from "src/services/ApiService/lib/FolderService";
import { OrganizationService } from "src/services/OrganizationService";

export const OrganizationController = {
  getMe: async (req: Request, res: Response) => {
    const user = req["user"];
    res.send(user);
  },
  getFolders: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const folders = await FolderService.getFolders(organization._id);
    res.send({ folders });
  },
  createOrganization: async (req: Request, res: Response) => {
    const { name } = req.body;
    const organization = await OrganizationService.createOrganization(name);
    res.send(organization);
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
};
