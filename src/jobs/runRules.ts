import { executeJob } from "src/backfills/lib";
import { Organization } from "src/models/Organization";
import { RuleService } from "src/services/RuleService";

export const runRulesJob = async () => {
  const organizations = await Organization.find({}, { _id: 1 }).lean().exec();
  for (const org of organizations) {
    await RuleService.runAllRulesForOrganization(org._id.toString());
  }
};

executeJob(runRulesJob);
