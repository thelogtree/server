import { executeJob } from "src/backfills/lib";
import { UsageService } from "src/services/ApiService/lib/UsageService";

export const removeLogsOlderThanRetentionDateJob =
  UsageService.removeLogsOlderThanRetentionDate;
executeJob(removeLogsOlderThanRetentionDateJob);
