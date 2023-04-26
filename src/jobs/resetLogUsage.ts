import { executeJob } from "src/backfills/lib";
import { UsageService } from "src/services/ApiService/lib/UsageService";

export const resetUsagesJob = UsageService.resetUsages;
executeJob(resetUsagesJob);
