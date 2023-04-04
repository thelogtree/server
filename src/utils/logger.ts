import axios from "axios";
import { config } from "./config";

const BASE_URL = "https://logtree-server.onrender.com/api/v1";

export const Logger = {
  sendLog: async (
    content: string,
    folderPath: string,
    referenceId?: string
  ) => {
    try {
      await axios.post(
        BASE_URL + "/logs",
        {
          content, // what you want to log
          folderPath, // where you want to log it in logtree. e.g. "/transactions"
          referenceId,
        },
        {
          headers: {
            "x-logtree-key": config.logtree.publishableApiKey, // this is your publishable api key
            authorization: config.logtree.plaintextSecretKey,
          },
        }
      );
    } catch (e) {
      // todo: log this error in sentry
    }
  },
};
