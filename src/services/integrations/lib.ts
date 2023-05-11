import { integrationTypeEnum } from "logtree-types";
import { SentryService } from "./components/SentryService";
import {
  ExchangeOAuthTokenAndConnectFxnType,
  FinishSetupFxnType,
  GetIntegrationLogsFxnType,
  GetOAuthLinkFxnType,
  RemoveOAuthConnectionType,
} from "./types";
import { MixpanelService } from "./components/MixpanelService";
import { IntercomService } from "./components/IntercomService";

// ADDING A NEW INTEGRATION //
// Note: Do not deploy anything until the end.
// 1. update logtree-types with the new integration you want to add
// 2. create a service file for the integration like SentryService
// 3. update the array and maps below. if there is no finish setup fxn for the integration, give its value 'undefined' for IntegrationFinishSetupFunctionsToRunMap
// 4. update logtree-types on frontend and update IntegrationsToConnectToMap with info for the new integration. Then connect to the server locally and test the integration manually using the frontend + local backend.
// 5. if everything works as expected, deploy the backend and frontend. order should not matter.

// PAUSING AN INTEGRATION
// remove it from the integrationsAvailableToConnectTo array below and optionally remove it from the IntegrationGetLogsMap below
// (depends on if you want already-connected integrations for that integration to continue working--if you remove it, it will fail silently).
// then deploy. the frontend will automatically update to stop showing that integration, so no frontend changes are necessary.

// PERMANENTLY REMOVE AN INTEGRATION (better to only do this if you are positive you won't need it again)
// to remove an integration permanently, follow the above instructions to pause it first, then make sure organizations aren't using the integration (delete those documents if so).
// then remove the integration from logtree-types, update the frontend and backend with the updated types library, then remove the integration from IntegrationsToConnectToMap on the frontend.

// these are the integrations someone can currently create a new connection to
export const integrationsAvailableToConnectTo: integrationTypeEnum[] = [
  integrationTypeEnum.Sentry,
  integrationTypeEnum.Mixpanel,
  integrationTypeEnum.Intercom,
];

// functions for getting logs for an integration
export const IntegrationGetLogsMap: {
  [key in integrationTypeEnum]: GetIntegrationLogsFxnType | undefined;
} = {
  sentry: SentryService.getLogs,
  mixpanel: MixpanelService.getLogs,
  intercom: IntercomService.getLogs,
};

// functions for getting the functions to run when finishing connecting an integration
// these can be used for doing additional setup work or for testing that the api key(s) provided are valid.
export const IntegrationFinishSetupFunctionsToRunMap: {
  [key in integrationTypeEnum]: FinishSetupFxnType;
} = {
  sentry: SentryService.finishConnection,
  mixpanel: undefined,
  intercom: IntercomService.finishConnection,
};

// functions for connecting the integration if the integration is using OAuth
export const IntegrationExchangeOAuthTokenAndConnectMap: {
  [key in integrationTypeEnum]: ExchangeOAuthTokenAndConnectFxnType | undefined;
} = {
  sentry: undefined,
  mixpanel: undefined,
  intercom: IntercomService.exchangeOAuthTokenAndConnect,
};

// functions for getting the OAuth redirect link (if the integration connects via OAuth)
export const IntegrationGetOAuthLinkMap: {
  [key in integrationTypeEnum]: GetOAuthLinkFxnType | undefined;
} = {
  sentry: undefined,
  mixpanel: undefined,
  intercom: IntercomService.getIntegrationOAuthLink,
};

// functions for removing an OAuth connection for an integration
export const IntegrationRemoveOAuthMap: {
  [key in integrationTypeEnum]: RemoveOAuthConnectionType | undefined;
} = {
  sentry: undefined,
  mixpanel: undefined,
  intercom: IntercomService.removeOAuthConnection,
};
