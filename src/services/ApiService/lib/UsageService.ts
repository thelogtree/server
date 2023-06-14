import { OrganizationDocument } from "logtree-types";
import { Organization } from "src/models/Organization";
import _ from "lodash";
import moment from "moment";
import { TRIAL_LOG_LIMIT } from "src/services/OrganizationService";
import { MyLogtree } from "src/utils/logger";
import { Log } from "src/models/Log";
import { SendgridUtil } from "src/utils/sendgrid";

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
    // see if they are over the limit or if the usage reset cron hasn't run yet.
    // if the reset cron hasn't run yet, give them a grace period and allow the log.
    return (
      organization.numLogsSentInPeriod < organization.logLimitForPeriod ||
      moment().isSameOrAfter(organization.cycleEnds)
    );
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
        cycleEnds: moment(now)
          .add(
            organization?.logRetentionInDays || PERIOD_DURATION_IN_DAYS,
            "days"
          )
          .toDate(),
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
        void MyLogtree.sendLog({
          content: `Just reset usage for ${org.name}.`,
          folderPath: "/usage",
          referenceId: org.slug,
        });
        const { cycleStarts, cycleEnds } = UsageService.getPeriodDates(org);
        await Organization.updateOne(
          { _id: org._id },
          { cycleStarts, cycleEnds, numLogsSentInPeriod: 0 }
        );
      })
    );

    const organizationsThatDidntResetLimit = await Organization.find(
      {
        _id: { $nin: organizations.map((o) => o._id) },
      },
      {
        numLogsSentInPeriod: 1,
        logLimitForPeriod: 1,
        sentLastUsageEmailAt: 1,
        cycleEnds: 1,
        _id: 1,
      }
    ).exec();
    await Promise.all(
      organizationsThatDidntResetLimit.map(async (org) => {
        if (
          org.numLogsSentInPeriod / org.logLimitForPeriod >= 0.9 &&
          (!org.sentLastUsageEmailAt ||
            moment().diff(moment(org.sentLastUsageEmailAt), "days") > 7)
        ) {
          const usageAmount = `${Math.min(
            Math.floor((org.numLogsSentInPeriod / org.logLimitForPeriod) * 100),
            100
          )}%`;
          const emails =
            await SendgridUtil.getEmailAddressesOfAllAdminsInOrganization(
              org._id.toString()
            );
          await SendgridUtil.sendEmail({
            to: emails,
            subject: "Logtree Usage Alert",
            text: `You've used up ${usageAmount} of your log quota, which will reset on ${moment(
              org.cycleEnds
            ).format(
              "MM/DD/YYYY"
            )}. If you'd like to increase your quota and continue using Logtree, please email andy@logtree.co.`,
          });
          await Organization.updateOne(
            { _id: org._id },
            { sentLastUsageEmailAt: new Date() }
          );
        }
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
