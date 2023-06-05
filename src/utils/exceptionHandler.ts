import * as Sentry from "@sentry/node";
import { config } from "./config";
import { MyLogtree } from "./logger";
import { getErrorMessage } from "./helpers";
import { ErrorMessages } from "./errors";

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
      if (
        !Object.values(ErrorMessages).includes(getErrorMessage(error as any))
      ) {
        MyLogtree.sendErrorLog(error, req);
      }
    } catch {}
    console.error(error);
    Sentry.captureException(error);
  }
  res.status(error.code || 500).send(error.message);
};
