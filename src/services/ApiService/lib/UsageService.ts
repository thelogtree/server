import { OrganizationDocument } from "logtree-types";
import { Organization } from "src/models/Organization";
import _ from "lodash";
import moment from "moment";
import { TRIAL_LOG_LIMIT } from "src/services/OrganizationService";
import { Logger } from "src/utils/logger";
import { Log } from "src/models/Log";

type PeriodDatesReturnType = {
  cycleStarts: Date;
  cycleEnds: Date;
};

export const UsageService = {
  recordNewLog: async (organization: OrganizationDocument) =>
    Organization.updateOne(
      { _id: organization._id },
      {
        $inc: { numLogsSentInPeriod: 1 },
      }
    ),
  shouldAllowAnotherLog: (organization: OrganizationDocument) => {
    // enforce api limits for these smaller accounts (most likely trials)
    if (organization.logLimitForPeriod <= TRIAL_LOG_LIMIT) {
      // see if they are over the limit or if the usage reset cron hasn't run yet.
      // if the reset cron hasn't run yet, give them a grace period and allow the log.
      return (
        organization.numLogsSentInPeriod < organization.logLimitForPeriod ||
        moment().isSameOrAfter(organization.cycleEnds)
      );
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
  resetUsages: async () => {
    const organizations = await Organization.find({
      cycleEnds: { $lte: new Date() },
    }).exec();
    await Promise.all(
      organizations.map(async (org) => {
        void Logger.sendLog(`Just reset usage for ${org.name}.`, "/usage");
        const { cycleStarts, cycleEnds } = UsageService.getPeriodDates(org);
        await Organization.updateOne(
          { _id: org._id },
          { cycleStarts, cycleEnds, numLogsSentInPeriod: 0 }
        );
      })
    );
  },
  removeLogsOlderThanRetentionDate: async () => {
    const organizations = await Organization.find(
      {},
      { logRetentionInDays: 1, _id: 1 }
    ).exec();
    await Promise.all(
      organizations.map(async (org) => {
        const cutoffDate = moment()
          .subtract(org.logRetentionInDays, "days")
          .toDate();
        await Log.deleteMany({
          organizationId: org._id,
          createdAt: { $lt: cutoffDate },
        });
      })
    );
  },
};
