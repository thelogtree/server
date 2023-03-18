import { Request, Response } from "express";
import { OrganizationService } from "src/services/OrganizationService";

export const OrganizationController = {
  getMe: async (req: Request, res: Response) => {
    const user = req["user"];
    res.send(user);
  },
  createOrganization: async (req: Request, res: Response) => {
    const { name } = req.body;
    const organization = await OrganizationService.createOrganization(name);
    res.send(organization);
  },
  generateSecretKey: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const plaintextSecretKey = await OrganizationService.generateSecretKey(
      organization
    );
    res.send({ plaintextSecretKey });
  },
  generateInviteLink: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const url = await OrganizationService.generateInviteLink(organization);
    res.send({ url });
  },
};
