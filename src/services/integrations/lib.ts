import { integrationTypeEnum } from "logtree-types";
import { SentryService } from "./components/SentryService";
import { FinishSetupFunctionType, GetIntegrationLogsFxnType } from "./types";

// ADDING A NEW INTEGRATION //
// Note: Do not deploy anything until the end.
// 1. update logtree-types with the new integration you want to add
// 2. create a service file for the integration like SentryService
// 3. update the array and maps below. if there is no finish setup fxn for the integration, give its value 'undefined' for IntegrationFinishSetupFunctionsToRunMap
// 4. before deploying anything, update logtree-types on frontend. Then connect to the server locally and test the integration manually using the frontend + local backend.
// 5. if everything works as expected, deploy the backend, then deploy the frontend after.

// these are the integrations someone can currently create a new connection to
export const integrationsAvailableToConnectTo: integrationTypeEnum[] = [
  integrationTypeEnum.Sentry,
];

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
