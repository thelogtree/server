import { integrationTypeEnum } from "logtree-types";
import { SentryService } from "./components/SentryService";
import { FinishSetupFunctionType, GetIntegrationLogsFxnType } from "./types";

// functions for getting logs for an integration
export const IntegrationGetLogsMap: {
  [key in integrationTypeEnum]: GetIntegrationLogsFxnType;
} = {
  sentry: SentryService.getLogs,
};

// functions for getting the functions to run when finishing connecting an integration
export const IntegrationFinishSetupFunctionsToRunMap: {
  [key in integrationTypeEnum]: FinishSetupFunctionType;
} = {
  sentry: SentryService.finishConnection,
};
