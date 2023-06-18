import { Organization } from "src/models/Organization";
import { executeJob } from "./lib";
import { Dashboard } from "src/models/Dashboard";
import { OrganizationService } from "src/services/OrganizationService";

// gives a dashboard to all organizations that don't have one yet
const executeBackfillBody = async () => {
  const organizations = await Organization.find().lean().exec();
  await Promise.all(
    organizations.map(async (org) => {
      const orgHasDashboard = await Dashboard.exists({
        organizationId: org._id,
      });
      if (!orgHasDashboard) {
        await OrganizationService.createDashboard(
          org._id.toString(),
          "production"
        );
      }
    })
  );
};

// see ReadMe on how to execute your backfill through the terminal.
// remember to remove your mongo connection string below before committing the change so it is not viewable on the github repo!!!!
// also be aware about whether this connection string points to staging or production.
executeJob(executeBackfillBody, "");
