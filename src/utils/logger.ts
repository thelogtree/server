import { config } from "./config";
import { Logtree } from "logtree-node";

const MyLogtree = new Logtree(
  config.logtree.publishableApiKey,
  config.logtree.plaintextSecretKey
);

export const Logger = {
  sendLog: async (
    content: string,
    folderPath: string,
    referenceId?: string,
    externalLink?: string
  ) => {
    if (config.environment.isTest) {
      return;
    }
    await MyLogtree.sendLog(content, folderPath, referenceId, externalLink);
  },
};
