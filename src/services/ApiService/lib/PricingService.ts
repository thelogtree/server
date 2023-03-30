import { OrganizationDocument } from "logtree-types";
import { Organization } from "src/models/Organization";
import _ from "lodash";

const COST_IN_DOLLARS_OF_LOG = 0.001;

export const PricingService = {
  chargeForLog: async (organization: OrganizationDocument) => {
    let newCurrentCredits = organization.currentCredits;
    let newCurrentCharges = organization.currentCharges;
    if (organization.currentCredits >= COST_IN_DOLLARS_OF_LOG) {
      newCurrentCredits -= COST_IN_DOLLARS_OF_LOG;
    } else {
      newCurrentCharges += COST_IN_DOLLARS_OF_LOG;
    }
    await Organization.updateOne(
      { _id: organization._id },
      {
        currentCredits: _.round(newCurrentCredits, 3),
        currentCharges: _.round(newCurrentCharges, 3),
      }
    );
  },
};
