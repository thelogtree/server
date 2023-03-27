import * as Sentry from "@sentry/node";
import { config } from "./config";
import { Logger } from "./logger";
import { getErrorMessage } from "./helpers";

export const exceptionHandler = (error, _req, res, _next) => {
  if (config.environment.isTest) {
    return res.send({
      success: false,
      errorMessage: error.message,
      errorCode: error.code,
    });
  } else {
    try {
      Logger.sendLog(getErrorMessage(error as any), "/errors");
    } catch {}
    console.error(error);
    Sentry.captureException(error);
  }
  res.status(error.code || 500).send(error.message);
};
