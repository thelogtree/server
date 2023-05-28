import { executeJob } from "src/backfills/lib";
import { CustomerSupportAssistantBotService } from "src/services/CustomerSupportAssistantBotService";

export const runCustomerSupportAssistantBotCron =
  CustomerSupportAssistantBotService.runCron;
executeJob(runCustomerSupportAssistantBotCron);
