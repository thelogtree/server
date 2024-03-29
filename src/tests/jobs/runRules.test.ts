import { comparisonTypeEnum, notificationTypeEnum } from "logtree-types";
import { FolderFactory } from "../factories/FolderFactory";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import { RuleFactory } from "../factories/RuleFactory";
import { UserFactory } from "../factories/UserFactory";
import { LogFactory } from "../factories/LogFactory";
import moment from "moment";
import { RuleService } from "src/services/RuleService";
import { Rule } from "src/models/Rule";
import { SendgridUtil } from "src/utils/sendgrid";
import { fakePromise } from "../mockHelpers";
import { runRulesJob } from "src/jobs/runRules";
import { TwilioUtil } from "src/utils/twilio";
import faker from "faker";

describe("RunRulesJob", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Rule.deleteMany();
  });
  it("correctly checks the ruleset for all organizations and executes the correct rules", async () => {
    const sendgridSpy = jest
      .spyOn(SendgridUtil, "sendEmail")
      .mockImplementation(fakePromise);
    const twilioSpy = jest
      .spyOn(TwilioUtil, "sendMessage")
      .mockImplementation(fakePromise);

    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
    });
    const user2 = await UserFactory.create({
      organizationId: organization._id,
      phoneNumber: faker.datatype.uuid(),
    });

    const folder1 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder2 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder3 = await FolderFactory.create();

    const rule1 = await RuleFactory.create({
      // triggers
      userId: user1._id,
      folderId: folder1._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 2,
      lookbackTimeInMins: 5,
    });
    const rule2 = await RuleFactory.create({
      // does not trigger
      userId: user1._id,
      folderId: folder1._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 2,
      lookbackTimeInMins: 1,
    });
    const rule3 = await RuleFactory.create({
      // triggers
      userId: user2._id,
      folderId: folder1._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 2,
      lookbackTimeInMins: 5,
      notificationType: notificationTypeEnum.SMS,
    });
    const rule4 = await RuleFactory.create({
      // triggers
      userId: user2._id,
      folderId: folder2._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 2,
      lookbackTimeInMins: 60,
      notificationType: notificationTypeEnum.Email,
    });
    const rule5 = await RuleFactory.create({
      // triggers
      folderId: folder3._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 2,
      lookbackTimeInMins: 60,
    });

    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(1, "minute").toDate(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(2, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(3, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(7, "minutes").toDate(),
    });

    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(3, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(67, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(68, "minutes").toDate(),
    });

    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(3, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(67, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(68, "minutes").toDate(),
    });

    await runRulesJob();

    const updatedRule1 = await Rule.findById(rule1._id);
    expect(updatedRule1?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule1?.numberOfTimesTriggered).toBe(1);

    const updatedRule2 = await Rule.findById(rule2._id);
    expect(updatedRule2?.lastTriggeredAt).toBeUndefined();
    expect(updatedRule2?.numberOfTimesTriggered).toBe(0);

    const updatedRule3 = await Rule.findById(rule3._id);
    expect(updatedRule3?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule3?.numberOfTimesTriggered).toBe(1);

    const updatedRule4 = await Rule.findById(rule4._id);
    expect(updatedRule4?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule4?.numberOfTimesTriggered).toBe(1);

    const updatedRule5 = await Rule.findById(rule5._id);
    expect(updatedRule5?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule5?.numberOfTimesTriggered).toBe(1);

    expect(sendgridSpy).toBeCalledTimes(3);
    expect(twilioSpy).toBeCalledTimes(1);
  });
});
