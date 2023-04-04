import { Request, Response } from "express";
import { ApiService } from "src/services/ApiService/ApiService";

export const ApiController = {
  createLog: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const { content, folderPath, referenceId } = req.body;
    await ApiService.createLog(
      organization,
      folderPath,
      content,
      referenceId || undefined,
      true
    );
    res.send({});
  },
  getLogs: async (req: Request, res: Response) => {
    const organization = req["organization"];
    const { folderPath, referenceId } = req.query;
    const logs = await ApiService.getLogs(
      organization,
      folderPath as string | undefined,
      referenceId as string | undefined
    );
    res.send(logs);
  },
  testZapierConnection: async (req: Request, res: Response) => {
    const organization = req["organization"];
    res.send({ name: organization.name });
  },
};
