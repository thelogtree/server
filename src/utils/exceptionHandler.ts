import * as Sentry from "@sentry/node";
import { config } from "./config";
import { Logger } from "./logger";
import { getErrorMessage } from "./helpers";

export const exceptionHandler = (error, req, res, _next) => {
  if (config.environment.isTest) {
    return res.send({
      success: false,
      errorMessage: error.message,
      errorCode: error.code,
    });
  } else {
    try {
      const organization = req["organization"];
      const user = req["user"];
      Logger.sendLog(
        getErrorMessage(error as any),
        "/errors",
        user?.email || organization?.slug
      );
    } catch {}
    console.error(error);
    Sentry.captureException(error);
  }
  res.status(error.code || 500).send(error.message);
};
