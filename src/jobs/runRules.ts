import { executeJob } from "src/backfills/lib";
import { Organization } from "src/models/Organization";
import { RuleService } from "src/services/RuleService";

export const runRulesJob = async () => {
  const organizations = await Organization.find();
  await Promise.all(
    organizations.map((organization) =>
      RuleService.runAllRulesForOrganization(organization._id.toString())
    )
  );
};

executeJob(runRulesJob);
