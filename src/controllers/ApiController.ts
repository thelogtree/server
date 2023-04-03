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
  testZapierConnection: async (req: Request, res: Response) => {
    res.send({});
  },
};
