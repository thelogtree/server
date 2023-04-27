import { Log } from "src/models/Log";
import { Organization } from "src/models/Organization";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import moment from "moment";
import { resetUsagesJob } from "src/jobs/resetLogUsage";
import { SendgridUtil } from "src/utils/sendgrid";
import { fakePromise } from "../mockHelpers";

describe("ResetUsagesJob", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Organization.deleteMany();
    await Log.deleteMany();
  });
  it("correctly resets the usages of organizations", async () => {
    const sendgridSpy = jest
      .spyOn(SendgridUtil, "sendEmail")
      .mockImplementation(fakePromise);

    const decoyOrg = await OrganizationFactory.create({
      numLogsSentInPeriod: 100,
      logLimitForPeriod: 100,
      sentLastUsageEmailAt: moment().subtract(2, "days").toDate(),
      cycleStarts: moment().subtract(29, "days").toDate(),
      cycleEnds: moment().add(5, "days").toDate(),
    });
    const org0 = await OrganizationFactory.create({
      numLogsSentInPeriod: 100,
      logLimitForPeriod: 100,
      sentLastUsageEmailAt: moment().subtract(20, "days").toDate(),
      cycleStarts: moment().subtract(29, "days").toDate(),
      cycleEnds: moment().add(5, "days").toDate(),
    });
    const org1 = await OrganizationFactory.create({
      numLogsSentInPeriod: 95,
      logLimitForPeriod: 100,
      cycleStarts: moment().subtract(29, "days").toDate(),
      cycleEnds: moment().add(2, "minutes").toDate(),
    });
    const org2 = await OrganizationFactory.create({
      numLogsSentInPeriod: 2,
      cycleStarts: moment().subtract(2, "minutes").toDate(),
      cycleEnds: moment().add(5, "days").toDate(),
    });
    const org3 = await OrganizationFactory.create({
      numLogsSentInPeriod: 2,
      cycleStarts: moment().subtract(20, "days").toDate(),
      cycleEnds: moment().subtract(2, "days").toDate(),
    });
    const org4 = await OrganizationFactory.create({
      numLogsSentInPeriod: 99,
      logLimitForPeriod: 100,
      cycleStarts: moment().subtract(30, "days").toDate(),
      cycleEnds: moment().subtract(2, "minutes").toDate(),
    });

    await resetUsagesJob();

    expect(sendgridSpy).toBeCalledTimes(2);

    const decoyOrgUpdated = await Organization.findById(decoyOrg._id);
    expect(decoyOrgUpdated?.numLogsSentInPeriod).toBe(100);
    expect(
      moment().diff(moment(decoyOrgUpdated?.sentLastUsageEmailAt), "days")
    ).toBeGreaterThanOrEqual(1);
    expect(
      moment().diff(moment(decoyOrgUpdated?.sentLastUsageEmailAt), "days")
    ).toBeLessThanOrEqual(3);

    const org0Updated = await Organization.findById(org0._id);
    expect(org0Updated?.numLogsSentInPeriod).toBe(100);
    expect(
      moment().diff(moment(org0Updated?.sentLastUsageEmailAt), "days")
    ).toBe(0);

    const org1Updated = await Organization.findById(org1._id);
    expect(org1Updated?.numLogsSentInPeriod).toBe(95);
    expect(
      moment().diff(moment(org1Updated?.sentLastUsageEmailAt), "days")
    ).toBe(0);
    expect(
      moment().diff(moment(org1Updated?.cycleStarts), "days")
    ).toBeGreaterThanOrEqual(29);
    expect(
      moment().diff(moment(org1Updated?.cycleStarts), "days")
    ).toBeLessThanOrEqual(30);
    expect(
      moment().diff(moment(org1Updated?.cycleEnds), "days")
    ).toBeGreaterThanOrEqual(0);
    expect(
      moment().diff(moment(org1Updated?.cycleEnds), "days")
    ).toBeLessThanOrEqual(1);

    const org2Updated = await Organization.findById(org2._id);
    expect(org2Updated?.numLogsSentInPeriod).toBe(2);
    expect(
      moment().diff(moment(org2Updated?.cycleStarts), "days")
    ).toBeGreaterThanOrEqual(0);
    expect(
      moment().diff(moment(org2Updated?.cycleStarts), "days")
    ).toBeLessThanOrEqual(1);
    expect(
      moment().diff(moment(org2Updated?.cycleEnds), "days")
    ).toBeGreaterThanOrEqual(-6);
    expect(
      moment().diff(moment(org2Updated?.cycleEnds), "days")
    ).toBeLessThanOrEqual(-4);

    const org3Updated = await Organization.findById(org3._id);
    expect(org3Updated?.numLogsSentInPeriod).toBe(0);
    expect(
      moment().diff(moment(org3Updated?.cycleStarts), "days")
    ).toBeGreaterThanOrEqual(0);
    expect(
      moment().diff(moment(org3Updated?.cycleStarts), "days")
    ).toBeLessThanOrEqual(2);
    expect(
      moment().diff(moment(org3Updated?.cycleEnds), "days")
    ).toBeGreaterThanOrEqual(-32);
    expect(
      moment().diff(moment(org3Updated?.cycleEnds), "days")
    ).toBeLessThanOrEqual(-27);

    const org4Updated = await Organization.findById(org4._id);
    expect(org4Updated?.numLogsSentInPeriod).toBe(0);
    expect(
      moment().diff(moment(org4Updated?.cycleStarts), "days")
    ).toBeGreaterThanOrEqual(0);
    expect(
      moment().diff(moment(org4Updated?.cycleStarts), "days")
    ).toBeLessThanOrEqual(2);
    expect(
      moment().diff(moment(org4Updated?.cycleEnds), "days")
    ).toBeGreaterThanOrEqual(-32);
    expect(
      moment().diff(moment(org4Updated?.cycleEnds), "days")
    ).toBeLessThanOrEqual(-29);
  });
});
