import { Request, Response } from "express";

export const OnlyTestController = {
  autoSuccess: async (_req: Request, res: Response) => {
    res.send({});
  },
};
