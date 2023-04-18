import { Organization } from "src/models/Organization";
import { RuleService } from "src/services/RuleService";
import { Logger } from "src/utils/logger";

export const runRulesJob = async () => {
  Logger.sendLog("lookkkk ", "/debugging");
  const organizations = await Organization.find({}, { _id: 1 }).lean().exec();
  Logger.sendLog("hereeeee " + organizations.length, "/debugging");
  await Promise.all(
    organizations.map((organization) =>
      RuleService.runAllRulesForOrganization(organization._id.toString())
    )
  );
  Logger.sendLog("end " + organizations.length, "/debugging");
};

runRulesJob();
