import { IntegrationDocument, integrationTypeEnum } from "logtree-types";
import { SimplifiedLog } from "../ApiService/lib/LogService";

export type GetIntegrationLogsFxnType = (
  integration: IntegrationDocument,
  query: string
) => Promise<SimplifiedLog[]>;

export type IntegrationServiceType = {
  getHeaders: (integration: IntegrationDocument) => Promise<any> | any;
  getLogs: GetIntegrationLogsFxnType;
  finishConnection?: (integration: IntegrationDocument) => Promise<any> | void;
};

export type FinishSetupFunctionType =
  | ((integration: IntegrationDocument) => Promise<any> | void)
  | undefined;
