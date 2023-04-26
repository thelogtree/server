import { Log } from "src/models/Log";
import { Organization } from "src/models/Organization";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import moment from "moment";
import { LogFactory } from "../factories/LogFactory";
import { removeLogsOlderThanRetentionDateJob } from "src/jobs/removeLogsOlderThanRetentionDate";

describe("RemoveLogsOlderThanRetentionDateJob", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Organization.deleteMany();
    await Log.deleteMany();
  });
  it("correctly resets the usages of organizations", async () => {
    const org1 = await OrganizationFactory.create({
      numLogsSentInPeriod: 2,
      logRetentionInDays: 7,
    });
    const log1 = await LogFactory.create({
      organizationId: org1._id,
      createdAt: moment().subtract(6, "days").toDate(),
    });
    const log2 = await LogFactory.create({
      organizationId: org1._id,
      createdAt: moment().subtract(1, "minute").toDate(),
    });
    const log3 = await LogFactory.create({
      organizationId: org1._id,
      createdAt: moment().subtract(8, "days").toDate(),
    });
    const log4 = await LogFactory.create({
      organizationId: org1._id,
      createdAt: moment().subtract(9, "days").toDate(),
    });

    const org2 = await OrganizationFactory.create({
      numLogsSentInPeriod: 3,
      logRetentionInDays: 30,
    });
    const log5 = await LogFactory.create({
      organizationId: org2._id,
      createdAt: moment().subtract(29, "days").toDate(),
    });
    const log6 = await LogFactory.create({
      organizationId: org2._id,
      createdAt: moment().subtract(3, "days").toDate(),
    });
    const log8 = await LogFactory.create({
      organizationId: org2._id,
      createdAt: moment().subtract(31, "days").toDate(),
    });
    const log7 = await LogFactory.create({
      organizationId: org2._id,
      createdAt: moment().subtract(1, "minute").toDate(),
    });
    const log9 = await LogFactory.create({
      organizationId: org2._id,
      createdAt: moment().subtract(45, "days").toDate(),
    });

    await removeLogsOlderThanRetentionDateJob();

    const updatedOrg1 = await Organization.findById(org1._id);
    expect(updatedOrg1?.numLogsSentInPeriod).toBe(2);

    const updatedOrg2 = await Organization.findById(org2._id);
    expect(updatedOrg2?.numLogsSentInPeriod).toBe(3);

    const numLogsInOrg1 = await Log.countDocuments({
      organizationId: org1._id,
    });
    expect(numLogsInOrg1).toBe(2);

    const numLogsInOrg2 = await Log.countDocuments({
      organizationId: org2._id,
    });
    expect(numLogsInOrg2).toBe(3);

    const log1Exists = await Log.exists({ _id: log1._id });
    expect(log1Exists).toBeTruthy();

    const log2Exists = await Log.exists({ _id: log2._id });
    expect(log2Exists).toBeTruthy();

    const log3Exists = await Log.exists({ _id: log3._id });
    expect(log3Exists).toBeFalsy();

    const log4Exists = await Log.exists({ _id: log4._id });
    expect(log4Exists).toBeFalsy();

    const log5Exists = await Log.exists({ _id: log5._id });
    expect(log5Exists).toBeTruthy();

    const log6Exists = await Log.exists({ _id: log6._id });
    expect(log6Exists).toBeTruthy();

    const log7Exists = await Log.exists({ _id: log7._id });
    expect(log7Exists).toBeTruthy();

    const log8Exists = await Log.exists({ _id: log8._id });
    expect(log8Exists).toBeFalsy();

    const log9Exists = await Log.exists({ _id: log9._id });
    expect(log9Exists).toBeFalsy();
  });
});
