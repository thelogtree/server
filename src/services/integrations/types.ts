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

export type GetOAuthLinkFxnType = (
  openOAuthRequest: OAuthRequestDocument
) => string;

export type RemoveOAuthConnectionType = (
  integration: IntegrationDocument
) => Promise<void>;

export type RemoveOAuthConnectionElsewhereType = (
  details: any
) => Promise<void>;

export type VerifyWebhookCameFromTrustedSourceType = (
  headers: any,
  body: any
) => boolean;

export type IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => Promise<any> | any;
  getLogs: GetIntegrationLogsFxnType;
  finishConnection?: (integration: IntegrationDocument) => Promise<any> | void;
  exchangeOAuthTokenAndConnect?: ExchangeOAuthTokenAndConnectFxnType;
  getIntegrationOAuthLink?: GetOAuthLinkFxnType;
  removeOAuthConnection?: RemoveOAuthConnectionType;
  removedOAuthConnectionElsewhereAndNeedToUpdateOurOwnRecords?: RemoveOAuthConnectionElsewhereType;
  verifyWebhookCameFromTrustedSource?: VerifyWebhookCameFromTrustedSourceType;
};
