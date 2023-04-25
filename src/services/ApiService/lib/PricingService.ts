import { OrganizationDocument } from "logtree-types";
import { Organization } from "src/models/Organization";
import _ from "lodash";
import moment from "moment";
import { TRIAL_LOG_LIMIT } from "src/services/OrganizationService";

type PeriodDatesReturnType = {
  cycleStarts: Date;
  cycleEnds: Date;
};

export const PricingService = {
  chargeForLog: async (organization: OrganizationDocument) =>
    Organization.updateOne(
      { _id: organization._id },
      {
        numLogsSentInPeriod: organization.numLogsSentInPeriod + 1,
      }
    ),
  shouldAllowAnotherLog: (organization: OrganizationDocument) => {
    // enforce api limits for these smaller accounts (most likely trials)
    if (organization.logLimitForPeriod <= TRIAL_LOG_LIMIT) {
      return organization.numLogsSentInPeriod < organization.logLimitForPeriod;
    }

    // enforce the limit manually with larger accounts
    return true;
  },
  getPeriodDates: (
    organization?: OrganizationDocument
  ): PeriodDatesReturnType => {
    const PERIOD_DURATION_IN_DAYS = 30;

    const hasStartDate = !!organization?.cycleStarts;
    if (!hasStartDate) {
      const now = moment();
      return {
        cycleStarts: moment(now).toDate(),
        cycleEnds: moment(now).add(PERIOD_DURATION_IN_DAYS, "days").toDate(),
      };
    }

    return {
      cycleStarts: moment(organization?.cycleEnds).toDate(),
      cycleEnds: moment(organization?.cycleEnds)
        .add(PERIOD_DURATION_IN_DAYS, "days")
        .toDate(),
    };
  },
};
