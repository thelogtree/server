import { Organization } from "src/models/Organization";
import { RuleService } from "src/services/RuleService";

export const runRulesJob = async () => {
  const organizations = await Organization.find({}, { _id: 1 }).lean().exec();
  await Promise.all(
    organizations.map((organization) =>
      RuleService.runAllRulesForOrganization(organization._id.toString())
    )
  );
};

runRulesJob();
