import {
  IntegrationDocument,
  OAuthRequestDocument,
  OrganizationDocument,
} from "logtree-types";
import { SimplifiedLog } from "../ApiService/lib/LogService";
import { LeanDocument } from "mongoose";

export type GetIntegrationLogsFxnType = (
  organization: OrganizationDocument,
  integration: IntegrationDocument,
  query: string
) => Promise<SimplifiedLog[]>;

export type FinishSetupFxnType =
  | ((integration: IntegrationDocument) => Promise<any> | void)
  | undefined;

export type ExchangeOAuthTokenAndConnectFxnType = (
  openOAuthRequest: LeanDocument<OAuthRequestDocument>,
  code: string
) => Promise<any>;

export type IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => Promise<any> | any;
  getLogs: GetIntegrationLogsFxnType;
  finishConnection?: (integration: IntegrationDocument) => Promise<any> | void;
  exchangeOAuthTokenAndConnect?: ExchangeOAuthTokenAndConnectFxnType;
};
