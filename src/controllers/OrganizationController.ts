import { Request, Response } from "express";

export const OrganizationController = {
  getMe: async (req: Request, res: Response) => {
    const user = req["user"];
    res.send(user);
  },
};
